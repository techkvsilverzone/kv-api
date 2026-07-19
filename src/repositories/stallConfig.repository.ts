import { StallConfig, IStallConfig } from '../models/stallConfig.model';

const GLOBAL_KEY = 'global';

export interface StallConfigValues {
  active: boolean;
}

export const DEFAULT_STALL_CONFIG: StallConfigValues = { active: false };

export class StallConfigRepository {
  public async get(): Promise<IStallConfig | null> {
    return StallConfig.findOne({ key: GLOBAL_KEY }).exec();
  }

  /** Whether offline-stall registration mode is currently active, defaulting to off. */
  public async getConfig(): Promise<StallConfigValues> {
    const config = await this.get();
    if (!config) return { ...DEFAULT_STALL_CONFIG };
    return { active: config.active };
  }

  public async upsert(data: StallConfigValues): Promise<IStallConfig> {
    return StallConfig.findOneAndUpdate(
      { key: GLOBAL_KEY },
      { $set: { active: data.active } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec() as Promise<IStallConfig>;
  }
}
