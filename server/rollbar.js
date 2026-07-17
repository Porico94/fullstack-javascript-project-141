import 'dotenv/config';
import Rollbar from 'rollbar';

const rollbar = new Rollbar({
  accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
  captureUncaught: true,
  captureUnhandledRejections: true,
  payload: {
    code_version: '1.0.0',
  },
  environment: process.env.ROLLBAR_ENVIRONMENT || 'development',
});

export default rollbar;