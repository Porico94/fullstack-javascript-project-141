import path from 'path';
import { fileURLToPath } from 'url';
import fastify from 'fastify';
import view from '@fastify/view';
import fastifyStatic from '@fastify/static';
import formbody from '@fastify/formbody';
import qs from 'qs';
import pug from 'pug';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import knex from 'knex';
import objection from 'objection';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyPassport from '@fastify/passport';
import knexConfig from '../knexfile.js';
import User from './models/User.js';
import TaskStatus from './models/TaskStatus.js';
import Task from './models/Task.js';
import Label from './models/Label.js';
import setupPassport from './lib/passport.js';
import Rollbar from 'rollbar';


const { Model } = objection;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createApp = async (options = {}, knexInstance = null) => {
  const app = fastify(options);

  const rollbar = new Rollbar({
    accessToken: process.env.ROLLBAR_TOKEN,
    captureUncaught: true,
    captureUnhandledRejections: true,
    environment: process.env.NODE_ENV || 'development',
  });

  app.setErrorHandler((error, request, reply) => {
    rollbar.error(error, request);
    reply.status(500).send({ error: 'Internal Server Error' });
  });

  const env = process.env.NODE_ENV || 'development';
  const db = knexInstance || knex(knexConfig[env]);
  Model.knex(db);

  await i18next
    .use(Backend)
    .init({
      lng: 'es',
      fallbackLng: 'es',
      initAsync: false,
      ns: ['translation'],
      defaultNS: 'translation',
      backend: {
        loadPath: path.join(__dirname, 'locales', '{{lng}}.json'),
      },
    });

  app.register(formbody, {
    parser: (str) => qs.parse(str),
  });

  app.register(fastifyCookie);

  app.register(fastifySession, {
    secret: process.env.SECRET_KEY || 'supersecretkey-development-only-change-in-production',
    cookie: {
      secure: false,
    },
  });

  app.register(fastifyPassport.initialize());
  app.register(fastifyPassport.secureSession());

  setupPassport(fastifyPassport);

  app.register(view, {
    engine: { pug },
    root: path.join(__dirname, 'views'),
  });

  app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'dist'),
    prefix: '/assets/',
  });

  app.decorateReply('render', function render(template, params = {}) {
    const allFlash = this.flash();
    return this.view(template, {
      ...params,
      t: i18next.t.bind(i18next),
      currentUser: this.request.user,
      flash: {
        success: (allFlash && allFlash.success) ? allFlash.success : [],
        error: (allFlash && allFlash.error) ? allFlash.error : [],
      },
    });
  });

  app.get('/', async (request, reply) => reply.render('index.pug'));

  app.get('/users', async (request, reply) => {
    const users = await User.query();
    return reply.render('users/index.pug', { users });
  });

  app.get('/users/new', async (request, reply) => {
    const user = new User();
    return reply.render('users/new.pug', { user });
  });

  app.get('/users/:id/edit', async (request, reply) => {
    const { id } = request.params;

    if (!request.user || request.user.id !== parseInt(id, 10)) {
      return reply.redirect('/');
    }

    const user = await User.query().findById(id);
    return reply.render('users/edit.pug', { user });
  });

  app.post('/users/:id', async (request, reply) => {
    const { id } = request.params;

    if (!request.user || request.user.id !== parseInt(id, 10)) {
      request.flash('error', i18next.t('accessDenied'));
      return reply.redirect('/');
    }

    const { data } = request.body;
    const user = await User.query().findById(id);

    user.firstName = data.firstName;
    user.lastName = data.lastName;
    user.email = data.email;

    if (data.password) {
      user.password = data.password;
    }

    try {
      await user.$query().update();
      request.flash('success', i18next.t('userUpdated'));
      return reply.redirect('/users');
    } catch (error) {
      request.flash('error', i18next.t('userUpdateError'));
      return reply.render('users/edit.pug', { user, errors: error.data });
    }
  });

  app.post('/users', async (request, reply) => {
    const { data } = request.body;
    try {
      const user = User.fromJson({}, { skipValidation: true });
      user.firstName = data.firstName;
      user.lastName = data.lastName;
      user.email = data.email;
      user.password = data.password;
      await User.query().insert(user);
      request.flash('success', i18next.t('userCreated'));
      return reply.redirect('/users');
    } catch (error) {
      request.flash('error', i18next.t('userCreateError'));
      return reply.render('users/new.pug', { user: data, errors: error.data });
    }
  });

  app.post('/users/:id/delete', async (request, reply) => {
    const { id } = request.params;

    if (!request.user || request.user.id !== parseInt(id, 10)) {
      request.flash('error', i18next.t('accessDenied'));
      return reply.redirect('/');
    }

    await User.query().deleteById(id);
    await request.logOut();
    request.flash('success', i18next.t('userDeleted'));
    return reply.redirect('/');
  });

  app.get('/session/new', async (request, reply) => {
    return reply.render('session/new.pug');
  });

  app.post('/session',
    fastifyPassport.authenticate('local', {
      successRedirect: '/',
      failureRedirect: '/session/new',
    }),
  );

  app.post('/session/delete', async (request, reply) => {
    await request.logOut();
    request.flash('success', i18next.t('loggedOut'));
    return reply.redirect('/');
  });

  app.get('/statuses', async (request, reply) => {
    const statuses = await TaskStatus.query();
    return reply.render('statuses/index.pug', { statuses });
  });

  app.get('/statuses/new', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    return reply.render('statuses/new.pug');
  });

  app.post('/statuses', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { name } = request.body;
    try {
      await TaskStatus.query().insert({ name });
      request.flash('success', i18next.t('statusCreated'));
      return reply.redirect('/statuses');
    } catch (error) {
      request.flash('error', i18next.t('statusCreateError'));
      return reply.render('statuses/new.pug', { errors: error.data });
    }
  });

  app.get('/statuses/:id/edit', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { id } = request.params;
    const status = await TaskStatus.query().findById(id);
    return reply.render('statuses/edit.pug', { status });
  });

  app.post('/statuses/:id', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { id } = request.params;
    const { name } = request.body;
    try {
      await TaskStatus.query().patchAndFetchById(id, { name });
      request.flash('success', i18next.t('statusUpdated'));
      return reply.redirect('/statuses');
    } catch (error) {
      const status = await TaskStatus.query().findById(id);
      request.flash('error', i18next.t('statusUpdateError'));
      return reply.render('statuses/edit.pug', { status, errors: error.data });
    }
  });

  app.post('/statuses/:id/delete', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { id } = request.params;
    await TaskStatus.query().deleteById(id);
    request.flash('success', i18next.t('statusDeleted'));
    return reply.redirect('/statuses');
  });

  app.get('/tasks', async (request, reply) => {
    const { statusId, executorId, labelId, isCreatorUser } = request.query;

    let tasksQuery = Task.query()
      .withGraphJoined('[status, creator, executor, labels]');

    if (statusId) {
      tasksQuery = tasksQuery.where('tasks.statusId', parseInt(statusId, 10));
    }

    if (executorId) {
      tasksQuery = tasksQuery.where('tasks.executorId', parseInt(executorId, 10));
    }

    if (labelId) {
      tasksQuery = tasksQuery.where('labels.id', parseInt(labelId, 10));
    }

    if (isCreatorUser && request.user) {
      tasksQuery = tasksQuery.where('tasks.creatorId', request.user.id);
    }

    const tasks = await tasksQuery;
    const statuses = await TaskStatus.query();
    const users = await User.query();
    const labels = await Label.query();

    return reply.render('tasks/index.pug', {
      tasks,
      statuses,
      users,
      labels,
      filterValues: request.query,
    });
  });

  app.get('/tasks/new', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const statuses = await TaskStatus.query();
    const users = await User.query();
    const labels = await Label.query();
    return reply.render('tasks/new.pug', { statuses, users, labels });
  });

  app.get('/tasks/:id', async (request, reply) => {
    const { id } = request.params;
    const task = await Task.query()
      .findById(id)
      .withGraphFetched('[status, creator, executor, labels]');
    return reply.render('tasks/show.pug', { task });
  });

  app.get('/tasks/:id/edit', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { id } = request.params;
    const task = await Task.query()
      .findById(id)
      .withGraphFetched('[labels]');
    const statuses = await TaskStatus.query();
    const users = await User.query();
    const labels = await Label.query();
    return reply.render('tasks/edit.pug', { task, statuses, users, labels });
  });

  app.post('/tasks', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { name, description, statusId, executorId, labelIds } = request.body;
    try {
      const task = await Task.query().insert({
        name,
        description,
        statusId: parseInt(statusId, 10),
        creatorId: request.user.id,
        executorId: executorId ? parseInt(executorId, 10) : null,
      });

      if (labelIds) {
        const ids = Array.isArray(labelIds) ? labelIds : [labelIds];
        for (const labelId of ids) {
          await task.$relatedQuery('labels').relate(parseInt(labelId, 10));
        }
      }

      request.flash('success', i18next.t('taskCreated'));
      return reply.redirect('/tasks');
    } catch (error) {      
      request.flash('error', i18next.t('taskCreateError'));
      const statuses = await TaskStatus.query();
      const users = await User.query();
      const labels = await Label.query();
      return reply.render('tasks/new.pug', { statuses, users, labels, errors: error.data });
    }
  });

  app.post('/tasks/:id', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { id } = request.params;
    const { name, description, statusId, executorId, labelIds } = request.body;
    try {
      const task = await Task.query().patchAndFetchById(id, {
        name,
        description,
        statusId: parseInt(statusId, 10),
        executorId: executorId ? parseInt(executorId, 10) : null,
      });

      await task.$relatedQuery('labels').unrelate();
      if (labelIds) {
        const ids = Array.isArray(labelIds) ? labelIds : [labelIds];
        for (const labelId of ids) {
          await task.$relatedQuery('labels').relate(parseInt(labelId, 10));
        }
      }

      request.flash('success', i18next.t('taskUpdated'));
      return reply.redirect('/tasks');
    } catch (error) {
      const task = await Task.query().findById(id);
      const statuses = await TaskStatus.query();
      const users = await User.query();
      const labels = await Label.query();
      request.flash('error', i18next.t('taskUpdateError'));
      return reply.render('tasks/edit.pug', { task, statuses, users, labels, errors: error.data });
    }
  });

  app.post('/tasks/:id/delete', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { id } = request.params;
    const task = await Task.query().findById(id);
    if (task.creatorId !== request.user.id) {
      request.flash('error', i18next.t('accessDenied'));
      return reply.redirect('/tasks');
    }
    await Task.query().deleteById(id);
    request.flash('success', i18next.t('taskDeleted'));
    return reply.redirect('/tasks');
  });

  app.get('/labels', async (request, reply) => {
    const labels = await Label.query();
    return reply.render('labels/index.pug', { labels });
  });

  app.get('/labels/new', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    return reply.render('labels/new.pug');
  });

  app.post('/labels', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { name } = request.body;
    try {
      await Label.query().insert({ name });
      request.flash('success', i18next.t('labelCreated'));
      return reply.redirect('/labels');
    } catch (error) {
      request.flash('error', i18next.t('labelCreateError'));
      return reply.render('labels/new.pug', { errors: error.data });
    }
  });

  app.get('/labels/:id/edit', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { id } = request.params;
    const label = await Label.query().findById(id);
    return reply.render('labels/edit.pug', { label });
  });

  app.post('/labels/:id', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { id } = request.params;
    const { name } = request.body;
    try {
      await Label.query().patchAndFetchById(id, { name });
      request.flash('success', i18next.t('labelUpdated'));
      return reply.redirect('/labels');
    } catch (error) {
      const label = await Label.query().findById(id);
      request.flash('error', i18next.t('labelUpdateError'));
      return reply.render('labels/edit.pug', { label, errors: error.data });
    }
  });

  app.post('/labels/:id/delete', async (request, reply) => {
    if (!request.user) {
      request.flash('error', i18next.t('authRequired'));
      return reply.redirect('/session/new');
    }
    const { id } = request.params;
    try {
      await Label.query().deleteById(id);
      request.flash('success', i18next.t('labelDeleted'));
    } catch (error) {
      request.flash('error', i18next.t('labelDeleteError'));
    }
    return reply.redirect('/labels');
  });
  
  return app;
};

export default createApp;