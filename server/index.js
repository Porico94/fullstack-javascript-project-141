import createApp from './plugin.js';

const port = process.env.PORT || 5000;
const host = process.env.HOST || '0.0.0.0';

const app = await createApp({ logger: true });

try {
  await app.listen({ port, host });
  console.log(`Server running at http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
