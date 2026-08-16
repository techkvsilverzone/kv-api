import { IPricingConfig } from '../domain/config';
import { queryOne } from '../infrastructure/postgres/pool';
import { toDate, toNum } from '../infrastructure/postgres/mapping';

export { IPricingConfig };

const GLOBAL_KEY = 'global';
export const DEFAULT_GST_PERCENT = 3;

interface PricingConfigRow {
  id: string;
  key: string;
  gst_percent: number;
  created_at: Date | null;
  updated_at: Date | null;
}

const mapConfig = (row: PricingConfigRow): IPricingConfig => ({
  _id: String(row.id),
  key: row.key,
  gstPercent: toNum(row.gst_percent, DEFAULT_GST_PERCENT),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

export class PricingConfigRepository {
  public async get(): Promise<IPricingConfig | null> {
    const row = await queryOne<PricingConfigRow>(
      'SELECT id, key, gst_percent, created_at, updated_at FROM pricing_config WHERE key = $1',
      [GLOBAL_KEY],
    );
    return row ? mapConfig(row) : null;
  }

  /** Current GST percent, falling back to the 3% default when unset. */
  public async getGstPercent(): Promise<number> {
    const config = await this.get();
    return config ? config.gstPercent : DEFAULT_GST_PERCENT;
  }

  public async upsert(data: { gstPercent: number }): Promise<IPricingConfig> {
    const row = await queryOne<PricingConfigRow>(
      `INSERT INTO pricing_config (key, gst_percent)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET
         gst_percent = EXCLUDED.gst_percent,
         updated_at  = NOW()
       RETURNING id, key, gst_percent, created_at, updated_at`,
      [GLOBAL_KEY, data.gstPercent],
    );

    return mapConfig(row!);
  }
}
