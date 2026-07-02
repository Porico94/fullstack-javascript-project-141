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
import setupPassport from './lib/passport.js';


const { Model } = objection;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createApp = async (options = {}) => {
  const app = fastify(options);

  const env = process.env.NODE_ENV || 'development';
  const knexInstance = knex(knexConfig[env]);
  Model.knex(knexInstance);

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

  return app;
};

export default createApp;