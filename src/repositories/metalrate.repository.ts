import { IMetalRate, MetalRate, MetalType } from '../models/metalrate.model';

export interface MetalRateUpsertParams {
  date: Date;
  metal: MetalType;
  karat: number | null;
  ratePerGram: number;
  updatedBy?: string;
}

export class MetalRateRepository {
  public async findToday(metal?: MetalType): Promise<IMetalRate[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const filter: Record<string, unknown> = { date: { $gte: today, $lt: tomorrow } };
    if (metal) filter.metal = metal;

    return MetalRate.find(filter).sort({ metal: -1, karat: 1 }).exec();
  }

  public async findHistory(days: number, metal?: MetalType): Promise<IMetalRate[]> {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const filter: Record<string, unknown> = { date: { $gte: from } };
    if (metal) filter.metal = metal;

    return MetalRate.find(filter).sort({ date: -1, metal: -1, karat: 1 }).exec();
  }

  public async findAll(metal?: MetalType): Promise<IMetalRate[]> {
    const filter: Record<string, unknown> = {};
    if (metal) filter.metal = metal;

    return MetalRate.find(filter).sort({ date: -1, metal: -1, karat: 1 }).exec();
  }

  public async upsertRate(params: MetalRateUpsertParams): Promise<IMetalRate> {
    const keyDate = new Date(params.date);
    keyDate.setHours(0, 0, 0, 0);
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
