import { SavingsRepository } from '../repositories/savings.repository';
import { SchemePlanRepository } from '../repositories/schemePlan.repository';
import { sendSavingsReminder, sendWhatsAppText, SavingsReminderKind } from '../utils/whatsapp';
import { addMonths } from '../utils/time';
import { ISavings } from '../domain/savings';
import Logger from '../utils/logger';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Reminder cadence, in days overdue past the installment's due date.
const REMINDER_DAYS: Record<number, SavingsReminderKind> = {
  1: 'day1',
  5: 'day5',
  10: 'day10',
  15: 'missed',
};

const daysBetween = (from: Date, to: Date): number => Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);

/** Full calendar months between two dates (server-local, matching `addMonths`'s own semantics). */
const monthsElapsed = (from: Date, to: Date): number =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

/**
 * Daily WhatsApp reminders for savings-scheme installments: day 1 / 5 / 10 overdue,
 * plus a final "missed" notice at day 15. Also drops a Diwali scheme (card rule 2 — removal
 * after N consecutive missed months, N = the plan's `maxConsecutiveMissedMonths`) once its
 * unpaid gap reaches that threshold. Meant to run once a day (see server.ts).
 */
export class SavingsReminderService {
  private savingsRepository: SavingsRepository;
  private schemePlanRepository: SchemePlanRepository;

  constructor() {
    this.savingsRepository = new SavingsRepository();
    this.schemePlanRepository = new SchemePlanRepository();
  }

  public async runDailyReminders(now: Date = new Date()): Promise<{ sent: number; skipped: number; dropped: number }> {
    const [schemes, plans] = await Promise.all([
      this.savingsRepository.findActiveWithUserPhone(),
      this.schemePlanRepository.findAll(),
    ]);
    const planByType = new Map(plans.map((p) => [p.type, p]));

    let sent = 0;
    let skipped = 0;
    let dropped = 0;

    for (const scheme of schemes) {
      const plan = planByType.get(scheme.schemeType);
      const realPayments = scheme.payments.filter((p) => p.amount > 0).length;

      // Item 4 (KV Smart Purchase Plan): a FLEXIBLE-mode scheme has no fixed monthly due date
      // to be overdue against — the customer pays any amount, any number of times, any time
      // within the plan's window — so the whole "next installment due" framing below doesn't
      // apply. Skip it here rather than reminding someone about a payment that was never due.
      if (plan?.paymentMode === 'FLEXIBLE') {
        skipped++;
        continue;
      }

      // Diwali removal — card rule 2: 3+ consecutive missed months drops the member.
      if (scheme.schemeType === 'DIWALI' && plan?.maxConsecutiveMissedMonths) {
        const missedMonths = Math.max(0, monthsElapsed(scheme.startDate, now) - realPayments);
        if (missedMonths >= plan.maxConsecutiveMissedMonths) {
          // eslint-disable-next-line no-await-in-loop
          await this.dropDiwaliScheme(scheme);
          dropped++;
          continue;
        }
      }

      const nextInstallmentMonth = realPayments + 1;
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

    Logger.info(`[savings-reminder] daily run complete — sent ${sent}, skipped ${skipped}, dropped ${dropped}`);
    return { sent, skipped, dropped };
  }

  private async dropDiwaliScheme(scheme: ISavings): Promise<void> {
    try {
      await this.savingsRepository.updateById(scheme._id.toString(), { status: 'Dropped' });
      const user = scheme.userId as unknown as { phone?: string } | null;
      if (user?.phone) {
        await sendWhatsAppText(
          user.phone,
          `Your KV Silver Zone Diwali Scheme${scheme.passbookNumber ? ` (${scheme.passbookNumber})` : ''} has been discontinued due to missed monthly payments. The amount already paid is redeemable as goods in-store — please contact us to arrange this.`,
        );
      }
    } catch (error) {
      Logger.error(`[savings-reminder] drop failed for ${scheme.passbookNumber}: ${String(error)}`);
    }
  }
}
