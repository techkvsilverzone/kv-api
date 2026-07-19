import { SavingsRepository } from '../repositories/savings.repository';
import { sendSavingsReminder, SavingsReminderKind } from '../utils/whatsapp';
import Logger from '../utils/logger';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Reminder cadence, in days overdue past the installment's due date.
const REMINDER_DAYS: Record<number, SavingsReminderKind> = {
  1: 'day1',
  5: 'day5',
  10: 'day10',
  15: 'missed',
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const daysBetween = (from: Date, to: Date): number => Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);

/**
 * Daily WhatsApp reminders for savings-scheme installments: day 1 / 5 / 10 overdue,
 * plus a final "missed" notice at day 15. Meant to run once a day (see server.ts).
 */
export class SavingsReminderService {
  private savingsRepository: SavingsRepository;

  constructor() {
    this.savingsRepository = new SavingsRepository();
  }

  public async runDailyReminders(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
    const schemes = await this.savingsRepository.findActiveWithUserPhone();
    let sent = 0;
    let skipped = 0;

    for (const scheme of schemes) {
      const nextInstallmentMonth = (scheme.payments?.length ?? 0) + 1;
      if (nextInstallmentMonth > scheme.duration) {
        skipped++;
        continue;
      }

      const dueDate = addMonths(scheme.startDate, nextInstallmentMonth);
      const daysOverdue = daysBetween(dueDate, now);
      const kind = REMINDER_DAYS[daysOverdue];
      if (!kind) {
        skipped++;
        continue;
      }

      const user = scheme.userId as unknown as { phone?: string } | null;
      if (!user?.phone) {
        skipped++;
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        await sendSavingsReminder(user.phone, kind, {
          passbookNumber: scheme.passbookNumber,
          monthlyAmount: scheme.monthlyAmount,
        });
        sent++;
      } catch (error) {
        Logger.error(`[savings-reminder] send failed for ${scheme.passbookNumber}: ${String(error)}`);
        skipped++;
      }
    }

    Logger.info(`[savings-reminder] daily run complete — sent ${sent}, skipped ${skipped}`);
    return { sent, skipped };
  }
}
