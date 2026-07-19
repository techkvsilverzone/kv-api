import { User } from '../models/user.model';
import { sendBirthdayWish, sendAnniversaryWish } from '../utils/whatsapp';
import Logger from '../utils/logger';

const isSameMonthDay = (date: Date, now: Date): boolean =>
  date.getUTCMonth() === now.getUTCMonth() && date.getUTCDate() === now.getUTCDate();

/**
 * Daily WhatsApp birthday and wedding-anniversary wishes. Only month/day are
 * compared — the year on `dateOfBirth`/`anniversaryDate` is irrelevant. Meant
 * to run once a day (see server.ts).
 */
export class BirthdayWishService {
  public async runDailyWishes(now: Date = new Date()): Promise<{ birthdays: number; anniversaries: number }> {
    const candidates = await User.find({
      isActive: true,
      phone: { $exists: true, $ne: '' },
      $or: [{ dateOfBirth: { $exists: true, $ne: null } }, { anniversaryDate: { $exists: true, $ne: null } }],
    })
      .select('name phone dateOfBirth anniversaryDate')
      .exec();

    let birthdays = 0;
    let anniversaries = 0;

    for (const user of candidates) {
      if (!user.phone) continue;

      if (user.dateOfBirth && isSameMonthDay(new Date(user.dateOfBirth), now)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await sendBirthdayWish(user.phone, user.name);
          birthdays++;
        } catch (error) {
          Logger.error(`[birthday-wish] send failed for ${user._id}: ${String(error)}`);
        }
      }

      if (user.anniversaryDate && isSameMonthDay(new Date(user.anniversaryDate), now)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await sendAnniversaryWish(user.phone, user.name);
          anniversaries++;
        } catch (error) {
          Logger.error(`[anniversary-wish] send failed for ${user._id}: ${String(error)}`);
        }
      }
    }

    Logger.info(`[birthday-wish] daily run complete — ${birthdays} birthdays, ${anniversaries} anniversaries`);
    return { birthdays, anniversaries };
  }
}
