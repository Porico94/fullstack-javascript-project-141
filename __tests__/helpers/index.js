import knex from 'knex';
import { Model } from 'objection';
import knexConfig from '../../knexfile.js';
import createApp from '../../server/plugin.js';

export const prepareDB = async () => {
  const knexInstance = knex(knexConfig.test);
  Model.knex(knexInstance);
  await knexInstance.migrate.latest();
  return knexInstance;
};

export const cleanDB = async (knexInstance) => {
  await knexInstance.migrate.rollback();
  await knexInstance.migrate.latest();
};

export const buildApp = async (knexInstance) => {
  const app = await createApp({ logger: false }, knexInstance);
  await app.ready();
  return app;
};