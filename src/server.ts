import app from './app';
import { config } from './config';
import Logger from './utils/logger';
import { connectMongo } from './utils/db';
import { seedAdmin } from './utils/seeder';
import { scheduleDailyIST } from './utils/scheduler';
import { RateGuardService } from './services/rateGuard.service';
import { SavingsReminderService } from './services/savingsReminder.service';
import { BirthdayWishService } from './services/birthdayWish.service';

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

    app.listen(PORT, () => {
      Logger.info(`Server is running on http://localhost:${PORT} in ${config.nodeEnv} mode`);
      Logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((error: unknown) => {
    Logger.error(`MongoDB connection error: ${String(error)}`);
    process.exit(1);
  });
