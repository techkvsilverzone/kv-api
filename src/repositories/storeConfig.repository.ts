import { StoreConfig, IStoreConfig } from '../models/storeConfig.model';

const GLOBAL_KEY = 'global';

export class StoreConfigRepository {
  public async get(): Promise<IStoreConfig | null> {
    return StoreConfig.findOne({ key: GLOBAL_KEY }).exec();
  }

  public async upsert(data: { theme?: string; isDark?: boolean }): Promise<IStoreConfig> {
    return StoreConfig.findOneAndUpdate(
      { key: GLOBAL_KEY },
      {
        $set: {
          theme: data.theme ?? 'icy-silver',
          isDark: data.isDark ?? false,
        },
      },
      { new: true, upsert: true },
    ).exec() as Promise<IStoreConfig>;
  }
}