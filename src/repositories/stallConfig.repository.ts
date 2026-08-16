import { IStallConfig } from '../domain/config';
import { queryOne } from '../infrastructure/postgres/pool';
import { toBool, toDate } from '../infrastructure/postgres/mapping';

export { IStallConfig };

const GLOBAL_KEY = 'global';

export interface StallConfigValues {
  active: boolean;
}

export const DEFAULT_STALL_CONFIG: StallConfigValues = { active: false };

interface StallConfigRow {
  id: string;
  key: string;
  is_enabled: boolean;
  created_at: Date | null;
  updated_at: Date | null;
}

/** The column is `is_enabled`; the application field has always been `active`. */
const mapConfig = (row: StallConfigRow): IStallConfig => ({
  _id: String(row.id),
  key: row.key,
  active: toBool(row.is_enabled),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

export class StallConfigRepository {
  public async get(): Promise<IStallConfig | null> {
    const row = await queryOne<StallConfigRow>(
      'SELECT id, key, is_enabled, created_at, updated_at FROM stall_config WHERE key = $1',
      [GLOBAL_KEY],
    );
    return row ? mapConfig(row) : null;
  }

  /** Whether offline-stall registration mode is currently active, defaulting to off. */
  public async getConfig(): Promise<StallConfigValues> {
    const config = await this.get();
    if (!config) return { ...DEFAULT_STALL_CONFIG };
    return { active: config.active };
  }

  public async upsert(data: StallConfigValues): Promise<IStallConfig> {
    const row = await queryOne<StallConfigRow>(
      `INSERT INTO stall_config (key, is_enabled)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()
       RETURNING id, key, is_enabled, created_at, updated_at`,
      [GLOBAL_KEY, data.active],
    );

    return mapConfig(row!);
  }
}
