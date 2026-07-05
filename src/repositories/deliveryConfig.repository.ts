import { DeliveryConfig, IDeliveryConfig } from '../models/deliveryConfig.model';

const GLOBAL_KEY = 'global';

export interface DeliveryConfigValues {
  chennai: number;
  otherDistrict: number;
  otherState: number;
}

export const DEFAULT_DELIVERY_CONFIG: DeliveryConfigValues = {
  chennai: 150,
  otherDistrict: 200,
  otherState: 250,
};

export class DeliveryConfigRepository {
  public async get(): Promise<IDeliveryConfig | null> {
    return DeliveryConfig.findOne({ key: GLOBAL_KEY }).exec();
  }

  /** Current zone delivery charges, falling back to defaults when unset. */
  public async getConfig(): Promise<DeliveryConfigValues> {
    const config = await this.get();
    if (!config) return { ...DEFAULT_DELIVERY_CONFIG };
    return {
      chennai: config.chennai,
      otherDistrict: config.otherDistrict,
      otherState: config.otherState,
    };
  }

  public async upsert(data: DeliveryConfigValues): Promise<IDeliveryConfig> {
    return DeliveryConfig.findOneAndUpdate(
      { key: GLOBAL_KEY },
      {
        $set: {
          chennai: data.chennai,
          otherDistrict: data.otherDistrict,
          otherState: data.otherState,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec() as Promise<IDeliveryConfig>;
  }
}
