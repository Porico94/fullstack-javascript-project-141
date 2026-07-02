import { Model } from 'objection';
import bcrypt from 'bcrypt';

export default class User extends Model {
  static get tableName() {
    return 'users';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['firstName', 'lastName', 'email', 'passwordDigest'],
      properties: {
        id: { type: 'integer' },
        firstName: { type: 'string', minLength: 1 },
        lastName: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email' },
        passwordDigest: { type: 'string' },
      },
    };
  }

  set password(value) {
    this.passwordDigest = bcrypt.hashSync(value, 10);
  }

  verifyPassword(password) {
    return bcrypt.compareSync(password, this.passwordDigest);
  }
}
