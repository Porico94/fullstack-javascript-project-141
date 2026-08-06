export const up = (knex) => knex.schema.createTable('users', (table) => {
  table.increments('id').primary();
  table.string('firstName').notNullable();
  table.string('lastName').notNullable();
  table.string('email').notNullable().unique();
  table.string('passwordDigest').notNullable();
  table.timestamps(true, true);
});

export const down = (knex) => knex.schema.dropTable('users');
