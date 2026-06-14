import { PricingConfig, IPricingConfig } from '../models/pricingConfig.model';

const GLOBAL_KEY = 'global';
export const DEFAULT_GST_PERCENT = 3;

export class PricingConfigRepository {
  public async get(): Promise<IPricingConfig | null> {
    return PricingConfig.findOne({ key: GLOBAL_KEY }).exec();
  }

  /** Current GST percent, falling back to the 3% default when unset. */
  public async getGstPercent(): Promise<number> {
    const config = await this.get();
    return config ? config.gstPercent : DEFAULT_GST_PERCENT;
  }

  public async upsert(data: { gstPercent: number }): Promise<IPricingConfig> {
    return PricingConfig.findOneAndUpdate(
      { key: GLOBAL_KEY },
      { $set: { gstPercent: data.gstPercent } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec() as Promise<IPricingConfig>;
  }
}
