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

describe('GET /users', () => {
  test('responde con 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users',
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('GET /users/new', () => {
  test('muestra el formulario de registro', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users/new',
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('POST /users', () => {
  test('crea un usuario con datos válidos y redirige', async () => {
    const response = await app.inject({
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
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/users');
  });

  test('no crea usuario con email duplicado', async () => {
    await createUser();
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        data: {
          firstName: 'Pool2',
          lastName: 'Rimari2',
          email: 'pool@test.com',
          password: 'password456',
        },
      },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('GET /session/new', () => {
  test('muestra el formulario de login', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/session/new',
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('POST /session', () => {
  test('login exitoso redirige a /', async () => {
    await createUser();
    const response = await app.inject({
      method: 'POST',
      url: '/session',
      payload: { email: 'pool@test.com', password: 'password123' },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/');
  });

  test('login fallido redirige a /session/new', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/session',
      payload: { email: 'noexiste@test.com', password: 'wrongpass' },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/session/new');
  });
});

describe('GET /users/:id/edit', () => {
  test('usuario logueado ve su formulario de edición', async () => {
    const userData = await createUser();
    const cookie = await loginAs(userData.email, userData.password);

    const usersResponse = await app.inject({
      method: 'GET',
      url: '/users',
    });
    const body = usersResponse.body;
    const match = body.match(/\/users\/(\d+)\/edit/);
    const userId = match[1];

    const response = await app.inject({
      method: 'GET',
      url: `/users/${userId}/edit`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
  });

  test('usuario no logueado es redirigido', async () => {
    await createUser();
    const response = await app.inject({
      method: 'GET',
      url: '/users/1/edit',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/');
  });
});

describe('POST /users/:id/delete', () => {
  test('usuario logueado puede eliminar su cuenta', async () => {
    const userData = await createUser();
    const cookie = await loginAs(userData.email, userData.password);

    const usersResponse = await app.inject({
      method: 'GET',
      url: '/users',
    });
    const match = usersResponse.body.match(/\/users\/(\d+)\/edit/);
    const userId = match[1];

    const response = await app.inject({
      method: 'POST',
      url: `/users/${userId}/delete`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/');

    const { Model } = await import('objection');
    const User = Model.query.bind(Model);
    const deletedUser = await app.inject({
      method: 'GET',
      url: '/users',
    });
    expect(deletedUser.body).not.toContain(userData.email);
  });

  test('usuario no logueado no puede eliminar', async () => {
    await createUser();
    const response = await app.inject({
      method: 'POST',
      url: '/users/1/delete',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/');
  });
});