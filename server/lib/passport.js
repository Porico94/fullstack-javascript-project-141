import passportStrategy from 'passport-local';
import User from '../models/User.js';

const LocalStrategy = passportStrategy.Strategy;

export default (passport) => {
  passport.use(new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      const user = await User.query().findOne({ email });

      if (!user) {
        return done(null, false);
      }

      if (!user.verifyPassword(password)) {
        return done(null, false);
      }

      return done(null, user);
    },
  ));

  passport.registerUserSerializer(async (user) => user.id);
  passport.registerUserDeserializer(async (id) => {
    const user = await User.query().findById(id);
    return user || false;
  });
};