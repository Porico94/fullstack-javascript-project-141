### Hexlet tests and linter status:

[![Actions Status](https://github.com/Porico94/fullstack-javascript-project-141/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/Porico94/fullstack-javascript-project-141/actions)

## Task Manager

Un gestor de tareas fullstack construido con Node.js, Fastify y PostgreSQL.

### Demo

https://hexlet-task-manager-9927.onrender.com

### Stack tecnológico

**Backend:**

- Node.js + Fastify v5
- Objection.js + Knex (ORM)
- PostgreSQL (producción) / SQLite (desarrollo y tests)
- Passport.js (autenticación)
- i18next (internacionalización)
- Rollbar (monitoreo de errores)

**Frontend:**

- Pug (motor de plantillas)
- Bootstrap 5
- Webpack

### Funcionalidades

- Registro y autenticación de usuarios
- CRUD de estados de tareas
- CRUD de tareas con relaciones (creador, ejecutor, estado)
- CRUD de etiquetas con relación many-to-many con tareas
- Filtrado de tareas por estado, ejecutor, etiqueta y creador
- Mensajes flash para feedback al usuario
- Tests de integración con Jest

### Instalación local

```bash
git clone https://github.com/Porico94/fullstack-javascript-project-141.git
cd fullstack-javascript-project-141
make setup
make start
```

### Variables de entorno

NODE_ENV=development
PORT=5000
SECRET_KEY=tu_clave_secreta
DATABASE_URL=postgresql://... (solo para producción)
ROLLBAR_ACCESS_TOKEN=tu_token
ROLLBAR_ENVIRONMENT=production

### Tests

```bash
npm test
```
