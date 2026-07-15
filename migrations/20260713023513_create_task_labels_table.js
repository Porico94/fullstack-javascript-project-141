export const up = (knex) => knex.schema.createTable('task_labels', (table) => {
  table.integer('taskId').unsigned().references('id').inTable('tasks').notNullable().onDelete('CASCADE');
  table.integer('labelId').unsigned().references('id').inTable('labels').notNullable().onDelete('CASCADE');
  table.primary(['taskId', 'labelId']);
});

export const down = (knex) => knex.schema.dropTable('task_labels');