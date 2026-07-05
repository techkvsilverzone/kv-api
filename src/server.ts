import app from './app';
import { config } from './config';
import Logger from './utils/logger';
import { connectMongo } from './utils/db';
import { seedAdmin } from './utils/seeder';
import { scheduleDailyIST } from './utils/scheduler';
import { RateGuardService } from './services/rateGuard.service';

const PORT = config.port;

connectMongo()
  .then(async () => {
    await seedAdmin();

    // #25 daily price-update guard: re-evaluate now (so a restart after the
    // cutoff re-locks immediately) and every day at the cutoff hour (IST).
    const rateGuardService = new RateGuardService();
    rateGuardService
      .checkAndNotify()
      .catch((error: unknown) => Logger.error(`[rate-guard] startup check failed: ${String(error)}`));
    scheduleDailyIST(
      config.rateUpdateCutoffHour,
      0,
      () => rateGuardService.checkAndNotify().then(() => undefined),
      'rate-update-guard',
    );

    app.listen(PORT, () => {
      Logger.info(`Server is running on http://localhost:${PORT} in ${config.nodeEnv} mode`);
      Logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((error: unknown) => {
    Logger.error(`MongoDB connection error: ${String(error)}`);
    process.exit(1);
  });
