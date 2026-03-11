import app from './app';
import { config } from './config';
import Logger from './utils/logger';
import { connectMongo } from './utils/db';

const PORT = config.port;

connectMongo()
  .then(() => {
    app.listen(PORT, () => {
      Logger.info(`Server is running on http://localhost:${PORT} in ${config.nodeEnv} mode`);
      Logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((error: unknown) => {
    Logger.error(`MongoDB connection error: ${String(error)}`);
    process.exit(1);
  });
