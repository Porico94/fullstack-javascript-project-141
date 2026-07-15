import { prepareDB, cleanDB, buildApp } from './helpers/index.js';

let app;
let knexInstance;

beforeAll(async () => {
  knexInstance = await prepareDB();
  app = await buildApp(knexInstance);
});

afterEach(async () => {
  await cleanDB(knexInstance);
});

afterAll(async () => {
  await app.close();
  await knexInstance.destroy();
});

const createUser = async (overrides = {}) => {
  const userData = {
    firstName: 'Pool',
    lastName: 'Rimari',
    email: 'pool@test.com',
    password: 'password123',
    ...overrides,
  };
  await app.inject({
    method: 'POST',
    url: '/users',
    payload: { data: userData },
  });
  return userData;
};

const loginAs = async (email, password) => {
  const response = await app.inject({
    method: 'POST',
    url: '/session',
    payload: { email, password },
  });
  return response.headers['set-cookie'];
};

const createStatus = async (cookie) => {
  await app.inject({
    method: 'POST',
    url: '/statuses',
    headers: { cookie },
    payload: { name: 'Nuevo' },
  });
  const response = await app.inject({
    method: 'GET',
    url: '/statuses',
  });
  const match = response.body.match(/\/statuses\/(\d+)\/edit/);
  return match[1];
};

const createTask = async (cookie, statusId) => {
  await app.inject({
    method: 'POST',
    url: '/tasks',
    headers: { cookie },
    payload: {
      name: 'Tarea de prueba',
      description: 'Descripción de prueba',
      statusId,
    },
  });
  const response = await app.inject({
    method: 'GET',
    url: '/tasks',
  });
  const match = response.body.match(/\/tasks\/(\d+)/);
  return match[1];
};

describe('GET /tasks', () => {
  test('responde con 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/tasks',
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('GET /tasks/new', () => {
  test('usuario logueado ve el formulario', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const response = await app.inject({
      method: 'GET',
      url: '/tasks/new',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
  });

  test('usuario no logueado es redirigido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/tasks/new',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('POST /tasks', () => {
  test('usuario logueado crea una tarea', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const statusId = await createStatus(cookie);
    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { cookie },
      payload: {
        name: 'Nueva tarea',
        description: 'Descripción',
        statusId,
      },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/tasks');
  });

  test('usuario no logueado no puede crear tarea', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { name: 'Nueva tarea', statusId: 1 },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('GET /tasks/:id', () => {
  test('muestra la tarea correctamente', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const statusId = await createStatus(cookie);
    const taskId = await createTask(cookie, statusId);
    const response = await app.inject({
      method: 'GET',
      url: `/tasks/${taskId}`,
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('GET /tasks/:id/edit', () => {
  test('usuario logueado ve el formulario de edición', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const statusId = await createStatus(cookie);
    const taskId = await createTask(cookie, statusId);
    const response = await app.inject({
      method: 'GET',
      url: `/tasks/${taskId}/edit`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
  });

  test('usuario no logueado es redirigido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/tasks/1/edit',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('POST /tasks/:id', () => {
  test('usuario logueado actualiza una tarea', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const statusId = await createStatus(cookie);
    const taskId = await createTask(cookie, statusId);
    const response = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}`,
      headers: { cookie },
      payload: {
        name: 'Tarea actualizada',
        statusId,
      },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/tasks');
  });

  test('usuario no logueado no puede actualizar', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/tasks/1',
      payload: { name: 'Actualizada', statusId: 1 },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('POST /tasks/:id/delete', () => {
  test('creador puede eliminar su tarea', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const statusId = await createStatus(cookie);
    const taskId = await createTask(cookie, statusId);
    const response = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/delete`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/tasks');
    const listResponse = await app.inject({
      method: 'GET',
      url: '/tasks',
    });
    expect(listResponse.body).not.toContain('Tarea de prueba');
  });

  test('usuario no logueado no puede eliminar', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/tasks/1/delete',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });

  test('otro usuario no puede eliminar la tarea', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const statusId = await createStatus(cookie);
    const taskId = await createTask(cookie, statusId);

    await createUser({ email: 'otro@test.com', firstName: 'Otro' });
    const cookieOtro = await loginAs('otro@test.com', 'password123');

    const response = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/delete`,
      headers: { cookie: cookieOtro },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/tasks');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/tasks',
    });
    expect(listResponse.body).toContain('Tarea de prueba');
  });

  describe('GET /tasks con filtros', () => {
  test('filtra tareas por estado', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const statusId = await createStatus(cookie);
    await createTask(cookie, statusId);

    const response = await app.inject({
      method: 'GET',
      url: `/tasks?statusId=${statusId}`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Tarea de prueba');
  });

  test('filtra tareas por estado inexistente devuelve lista vacía', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const statusId = await createStatus(cookie);
    await createTask(cookie, statusId);

    const response = await app.inject({
      method: 'GET',
      url: '/tasks?statusId=9999',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain('Tarea de prueba');
  });

  test('filtra tareas del usuario actual', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const statusId = await createStatus(cookie);
    await createTask(cookie, statusId);

    const response = await app.inject({
      method: 'GET',
      url: '/tasks?isCreatorUser=1',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Tarea de prueba');
  });
});
});