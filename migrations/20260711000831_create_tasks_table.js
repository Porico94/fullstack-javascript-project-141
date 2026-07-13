export const up = (knex) => knex.schema.createTable('tasks', (table) => {
  table.increments('id').primary();
  table.string('name').notNullable();
  table.text('description');
  table.integer('statusId').unsigned().references('id').inTable('task_statuses').notNullable();
  table.integer('creatorId').unsigned().references('id').inTable('users').notNullable();
  table.integer('executorId').unsigned().references('id').inTable('users');
  table.timestamps(true, true);
});

export const down = (knex) => knex.schema.dropTable('tasks');