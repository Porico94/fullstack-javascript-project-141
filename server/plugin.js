import fastify from 'fastify';

const createApp = async (options = {}) => {
  const app = fastify(options);

  app.get('/', async (request, reply) => {
    return reply.send('Welcome to Task Manager!');
  });

  return app;
};

export default createApp;
