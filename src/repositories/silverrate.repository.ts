import { SilverRate, ISilverRate } from '../models/silverrate.model';

export { ISilverRate };

export class SilverRateRepository {
  public async findToday(): Promise<ISilverRate[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return SilverRate.find({ rateDate: { $gte: today, $lt: tomorrow } })
      .sort({ purity: 1 })
      .exec();
  }

  public async findHistory(days: number): Promise<ISilverRate[]> {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    return SilverRate.find({ rateDate: { $gte: from } })
      .sort({ rateDate: -1, purity: 1 })
      .exec();
  }

  public async findAll(): Promise<ISilverRate[]> {
    return SilverRate.find().sort({ rateDate: -1, purity: 1 }).exec();
  }

  public async upsertTodayRate(
    ratePerGram: number,
    purity: string,
    updatedBy?: string,
  ): Promise<ISilverRate> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ratePerKg = ratePerGram * 1000;

    return SilverRate.findOneAndUpdate(
      { rateDate: today, purity },
      { ratePerGram, ratePerKg, updatedBy },
      { upsert: true, new: true },
    ).exec() as Promise<ISilverRate>;
  }
}
