import { IDeliveryConfig } from '../domain/config';
import { queryOne } from '../infrastructure/postgres/pool';
import { toDate, toNum } from '../infrastructure/postgres/mapping';

export { IDeliveryConfig };

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

interface DeliveryConfigRow {
  id: string;
  key: string;
  chennai: number;
  other_district: number;
  other_state: number;
  created_at: Date | null;
  updated_at: Date | null;
}

const mapConfig = (row: DeliveryConfigRow): IDeliveryConfig => ({
  _id: String(row.id),
  key: row.key,
  chennai: toNum(row.chennai, DEFAULT_DELIVERY_CONFIG.chennai),
  otherDistrict: toNum(row.other_district, DEFAULT_DELIVERY_CONFIG.otherDistrict),
  otherState: toNum(row.other_state, DEFAULT_DELIVERY_CONFIG.otherState),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

const SELECT = `
  SELECT id, key, chennai, other_district, other_state, created_at, updated_at
  FROM delivery_config`;

export class DeliveryConfigRepository {
  public async get(): Promise<IDeliveryConfig | null> {
    const row = await queryOne<DeliveryConfigRow>(`${SELECT} WHERE key = $1`, [GLOBAL_KEY]);
    return row ? mapConfig(row) : null;
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
    const row = await queryOne<DeliveryConfigRow>(
      `INSERT INTO delivery_config (key, chennai, other_district, other_state)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         chennai        = EXCLUDED.chennai,
         other_district = EXCLUDED.other_district,
         other_state    = EXCLUDED.other_state,
         updated_at     = NOW()
       RETURNING id, key, chennai, other_district, other_state, created_at, updated_at`,
      [GLOBAL_KEY, data.chennai, data.otherDistrict, data.otherState],
    );

    return mapConfig(row!);
  }
}
