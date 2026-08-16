import { Server } from 'http';
import app from './app';
import { config } from './config';
import Logger from './utils/logger';
import { connectPostgres, disconnectPostgres } from './infrastructure/postgres/pool';
import { seedAdmin } from './utils/seeder';
import { scheduleDailyIST } from './utils/scheduler';
import { RateGuardService } from './services/rateGuard.service';
import { SavingsReminderService } from './services/savingsReminder.service';
import { BirthdayWishService } from './services/birthdayWish.service';

const PORT = config.port;

let server: Server | undefined;

/**
 * Close the HTTP listener first so in-flight requests finish, then release the
 * PostgreSQL pool. Guarded against a second signal arriving mid-shutdown.
 */
let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  Logger.info(`${signal} received — shutting down`);

  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    Logger.info('HTTP server closed');
  }

  await disconnectPostgres();
  process.exit(0);
};

connectPostgres()
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
      () => rateGuardService.checkAndNotify(new Date(), true).then(() => undefined),
      'rate-update-guard',
    );

    // Savings installment reminders (day 1/5/10 overdue + missed) — once a day, morning IST.
    const savingsReminderService = new SavingsReminderService();
    scheduleDailyIST(
      9,
      0,
      () => savingsReminderService.runDailyReminders(new Date()).then(() => undefined),
      'savings-reminders',
    );

    // Birthday / wedding-anniversary WhatsApp wishes — once a day, morning IST.
    const birthdayWishService = new BirthdayWishService();
    scheduleDailyIST(
      9,
      30,
      () => birthdayWishService.runDailyWishes(new Date()).then(() => undefined),
      'birthday-anniversary-wishes',
    );

    server = app.listen(PORT, () => {
      Logger.info(`Server is running on http://localhost:${PORT} in ${config.nodeEnv} mode`);
      Logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((error: unknown) => {
    Logger.error(`PostgreSQL connection error: ${String(error)}`);
    process.exit(1);
  });

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
