import { MetalRateRepository } from '../repositories/metalrate.repository';
import { RateStatusRepository, RateStatusView } from '../repositories/rateStatus.repository';
import { StaleMetal } from '../models/rateStatus.model';
import { MetalType } from '../models/metalrate.model';
import { sendRateUpdateReminder, sendRateUpdateSuccessNotice } from '../utils/whatsapp';
import { isSameIstDay } from '../utils/time';
import Logger from '../utils/logger';

const METALS: { key: StaleMetal; metal: MetalType }[] = [
  { key: 'silver', metal: 'SILVER' },
  { key: 'gold', metal: 'GOLD' },
];

/**
 * Daily price-update guard (#25 B2). Determines which metals are missing today's
 * (IST) rate, persists the authoritative block flag, and — when something is
 * stale — fires the WhatsApp reminder. Designed to be called by the 10:00 IST
 * cron, but also safe to call on demand.
 */
export class RateGuardService {
  private readonly metalRateRepository: MetalRateRepository;
  private readonly rateStatusRepository: RateStatusRepository;

  constructor() {
    this.metalRateRepository = new MetalRateRepository();
    this.rateStatusRepository = new RateStatusRepository();
  }

  /** Read the current authoritative block flag (for GET /admin/rate-status). */
  public async getStatus(): Promise<RateStatusView> {
    return this.rateStatusRepository.getStatus();
  }

  /**
   * Recompute freshness, persist the flag, and notify on stale metals.
   *
   * `notifyOnSuccess` gates the "rates are live" WhatsApp confirmation — only the
   * scheduled 10 AM cron should send it; ad-hoc calls (server startup, tests,
   * post-save reconciliation) must stay silent on the success path so a restart
   * or admin edit doesn't spam the ops number.
   */
  public async checkAndNotify(now: Date = new Date(), notifyOnSuccess = false): Promise<RateStatusView> {
    const staleMetals: StaleMetal[] = [];
    const freshRates: { metal: string; ratePerGram: number }[] = [];

    for (const { key, metal } of METALS) {
      const latest = await this.metalRateRepository.findLatest(metal);
      const fresh = latest != null && isSameIstDay(latest.date, now);
      if (!fresh) {
        staleMetals.push(key);
      } else if (latest) {
        freshRates.push({ metal: key, ratePerGram: latest.ratePerGram });
      }
    }

    const blocked = staleMetals.length > 0;
    const status = await this.rateStatusRepository.setStatus(blocked, staleMetals, now);

    if (blocked) {
      Logger.warn(`[rate-guard] stale metals: ${staleMetals.join(', ')} — sending WhatsApp reminder`);
      await sendRateUpdateReminder(staleMetals);
    } else {
      Logger.info('[rate-guard] all metal rates up to date for today (IST)');
      if (notifyOnSuccess) {
        await sendRateUpdateSuccessNotice(freshRates);
      }
    }

    return status;
  }
}
