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

const createUser = async () => {
  await app.inject({
    method: 'POST',
    url: '/users',
    payload: {
      data: {
        firstName: 'Pool',
        lastName: 'Rimari',
        email: 'pool@test.com',
        password: 'password123',
      },
    },
  });
};

const loginAs = async (email, password) => {
  const response = await app.inject({
    method: 'POST',
    url: '/session',
    payload: { email, password },
  });
  return response.headers['set-cookie'];
};

describe('GET /labels', () => {
  test('responde con 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/labels',
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('GET /labels/new', () => {
  test('usuario logueado ve el formulario', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const response = await app.inject({
      method: 'GET',
      url: '/labels/new',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
  });

  test('usuario no logueado es redirigido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/labels/new',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('POST /labels', () => {
  test('usuario logueado crea una etiqueta', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const response = await app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'bug' },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/labels');
  });

  test('usuario no logueado no puede crear etiqueta', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/labels',
      payload: { name: 'bug' },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('GET /labels/:id/edit', () => {
  test('usuario logueado ve el formulario de edición', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    await app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'bug' },
    });
    const listResponse = await app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    const match = listResponse.body.match(/\/labels\/(\d+)\/edit/);
    const labelId = match[1];
    const response = await app.inject({
      method: 'GET',
      url: `/labels/${labelId}/edit`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
  });

  test('usuario no logueado es redirigido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/labels/1/edit',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('POST /labels/:id', () => {
  test('usuario logueado actualiza una etiqueta', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    await app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'bug' },
    });
    const listResponse = await app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    const match = listResponse.body.match(/\/labels\/(\d+)\/edit/);
    const labelId = match[1];
    const response = await app.inject({
      method: 'POST',
      url: `/labels/${labelId}`,
      headers: { cookie },
      payload: { name: 'feature' },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/labels');
  });
});

describe('POST /labels/:id/delete', () => {
  test('usuario logueado elimina una etiqueta', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    await app.inject({
      method: 'POST',
      url: '/labels',
      headers: { cookie },
      payload: { name: 'bug' },
    });
    const listResponse = await app.inject({
      method: 'GET',
      url: '/labels',
      headers: { cookie },
    });
    const match = listResponse.body.match(/\/labels\/(\d+)\/edit/);
    const labelId = match[1];
    const response = await app.inject({
      method: 'POST',
      url: `/labels/${labelId}/delete`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/labels');
    const afterDelete = await app.inject({
      method: 'GET',
      url: '/labels',
    });
    expect(afterDelete.body).not.toContain('bug');
  });

  test('usuario no logueado no puede eliminar', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/labels/1/delete',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});