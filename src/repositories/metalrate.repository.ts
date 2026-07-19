import { IMetalRate, MetalRate, MetalType } from '../models/metalrate.model';
import { istDayKey, istMidnightUtc } from '../utils/time';

export interface MetalRateUpsertParams {
  date: Date;
  metal: MetalType;
  karat: number | null;
  ratePerGram: number;
  updatedBy?: string;
}

export class MetalRateRepository {
  public async findToday(metal?: MetalType): Promise<IMetalRate[]> {
    const todayStart = istMidnightUtc(istDayKey());
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const filter: Record<string, unknown> = { date: { $gte: todayStart, $lt: tomorrowStart } };
    if (metal) filter.metal = metal;

    return MetalRate.find(filter).sort({ metal: -1, karat: 1 }).exec();
  }

  public async findHistory(days: number, metal?: MetalType): Promise<IMetalRate[]> {
    const todayKey = istDayKey();
    const fromKey = istDayKey(new Date(istMidnightUtc(todayKey).getTime() - days * 24 * 60 * 60 * 1000));
    const from = istMidnightUtc(fromKey);

    const filter: Record<string, unknown> = { date: { $gte: from } };
    if (metal) filter.metal = metal;

    return MetalRate.find(filter).sort({ date: -1, metal: -1, karat: 1 }).exec();
  }

  public async findAll(metal?: MetalType): Promise<IMetalRate[]> {
    const filter: Record<string, unknown> = {};
    if (metal) filter.metal = metal;

    return MetalRate.find(filter).sort({ date: -1, metal: -1, karat: 1 }).exec();
  }

  /** Most recent rate record for a metal (by date desc), or null if none exists. */
  public async findLatest(metal: MetalType): Promise<IMetalRate | null> {
    return MetalRate.findOne({ metal }).sort({ date: -1 }).exec();
  }

  public async upsertRate(params: MetalRateUpsertParams): Promise<IMetalRate> {
    // Trust params.date — the service layer already pins it to IST midnight
    // (istMidnightUtc). Re-normalizing here with setHours() would mutate in the
    // server's LOCAL timezone and silently shift it off the intended IST day.
    const keyDate = params.date;
    const ratePerKg = params.ratePerGram * 1000;

    return MetalRate.findOneAndUpdate(
      { date: keyDate, metal: params.metal, karat: params.karat },
      {
        date: keyDate,
        metal: params.metal,
        karat: params.karat,
        ratePerGram: params.ratePerGram,
        ratePerKg,
        updatedBy: params.updatedBy,
      },
      { upsert: true, new: true },
    ).exec() as Promise<IMetalRate>;
  }
}
