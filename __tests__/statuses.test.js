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

describe('GET /statuses', () => {
  test('responde con 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/statuses',
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('GET /statuses/new', () => {
  test('usuario logueado ve el formulario', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const response = await app.inject({
      method: 'GET',
      url: '/statuses/new',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
  });

  test('usuario no logueado es redirigido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/statuses/new',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('POST /statuses', () => {
  test('usuario logueado crea un estado', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    const response = await app.inject({
      method: 'POST',
      url: '/statuses',
      headers: { cookie },
      payload: { name: 'En progreso' },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/statuses');
  });

  test('usuario no logueado no puede crear estado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/statuses',
      payload: { name: 'En progreso' },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('GET /statuses/:id/edit', () => {
  test('usuario logueado ve el formulario de edición', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    await app.inject({
      method: 'POST',
      url: '/statuses',
      headers: { cookie },
      payload: { name: 'Nuevo' },
    });
    const statusesResponse = await app.inject({
      method: 'GET',
      url: '/statuses',
    });
    const match = statusesResponse.body.match(/\/statuses\/(\d+)\/edit/);
    const statusId = match[1];
    const response = await app.inject({
      method: 'GET',
      url: `/statuses/${statusId}/edit`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
  });

  test('usuario no logueado es redirigido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/statuses/1/edit',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('POST /statuses/:id', () => {
  test('usuario logueado actualiza un estado', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    await app.inject({
      method: 'POST',
      url: '/statuses',
      headers: { cookie },
      payload: { name: 'Nuevo' },
    });
    const statusesResponse = await app.inject({
      method: 'GET',
      url: '/statuses',
    });
    const match = statusesResponse.body.match(/\/statuses\/(\d+)\/edit/);
    const statusId = match[1];
    const response = await app.inject({
      method: 'POST',
      url: `/statuses/${statusId}`,
      headers: { cookie },
      payload: { name: 'Actualizado' },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/statuses');
  });
});

describe('POST /statuses/:id/delete', () => {
  test('usuario logueado elimina un estado', async () => {
    await createUser();
    const cookie = await loginAs('pool@test.com', 'password123');
    await app.inject({
      method: 'POST',
      url: '/statuses',
      headers: { cookie },
      payload: { name: 'Nuevo' },
    });
    const statusesResponse = await app.inject({
      method: 'GET',
      url: '/statuses',
    });
    const match = statusesResponse.body.match(/\/statuses\/(\d+)\/edit/);
    const statusId = match[1];
    const response = await app.inject({
      method: 'POST',
      url: `/statuses/${statusId}/delete`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/statuses');
    const listResponse = await app.inject({
      method: 'GET',
      url: '/statuses',
    });
    expect(listResponse.body).not.toContain('Nuevo');
  });
});