import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine which sqlite client to use
let client = process.env.DB_CLIENT || 'better-sqlite3';

// If better-sqlite3 is not available, fall back to sqlite3
try {
  require.resolve('better-sqlite3');
} catch {
  try {
    require.resolve('sqlite3');
    client = 'sqlite3';
  } catch {
    // In CI/CD, we might not need the client to be available
    client = 'better-sqlite3';
  }
}

export default {
  development: {
    client,
    connection: {
      filename: path.join(__dirname, 'database.sqlite3'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
    },
  },
  test: {
    client,
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
    },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
    },
  },
};
