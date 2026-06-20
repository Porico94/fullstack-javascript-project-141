import path from 'path';
import { fileURLToPath } from 'url';
import fastify from 'fastify';
import view from '@fastify/view';
import fastifyStatic from '@fastify/static';
import pug from 'pug';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createApp = async (options = {}) => {
  const app = fastify(options);

  await i18next
    .use(Backend)
    .init({
      lng: 'es',
      fallbackLng: 'es',
      backend: {
        loadPath: path.join(__dirname, 'locales', '{{lng}}.json'),
      },
    });

  app.register(view, {
    engine: { pug },
    root: path.join(__dirname, 'views'),
  });

  app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'dist'),
    prefix: '/assets/',
  });

  app.decorateReply('render', function render(template, params = {}) {
    return this.view(template, { ...params, t: i18next.t.bind(i18next) });
  });

  app.get('/', async (request, reply) => reply.render('index.pug'));

  return app;
};

export default createApp;
