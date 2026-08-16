import { IStoreConfig } from '../domain/config';
import { queryOne } from '../infrastructure/postgres/pool';
import { toBool, toDate, toStrArray } from '../infrastructure/postgres/mapping';

export { IStoreConfig };

const GLOBAL_KEY = 'global';

const SELECT = `
  SELECT id, key, theme, is_dark, marquee_messages, created_at, updated_at
  FROM store_config`;

interface StoreConfigRow {
  id: string;
  key: string;
  theme: string;
  is_dark: boolean;
  marquee_messages: string[] | null;
  created_at: Date | null;
  updated_at: Date | null;
}

const mapConfig = (row: StoreConfigRow): IStoreConfig => ({
  _id: String(row.id),
  key: row.key,
  theme: row.theme,
  isDark: toBool(row.is_dark),
  marqueeMessages: toStrArray(row.marquee_messages),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

export class StoreConfigRepository {
  public async get(): Promise<IStoreConfig | null> {
    const row = await queryOne<StoreConfigRow>(`${SELECT} WHERE key = $1`, [GLOBAL_KEY]);
    return row ? mapConfig(row) : null;
  }

  public async upsert(data: {
    theme?: string;
    isDark?: boolean;
    marqueeMessages?: string[];
  }): Promise<IStoreConfig> {
    // Full replace, as before: an omitted field resets to its default rather
    // than retaining the stored value.
    const row = await queryOne<StoreConfigRow>(
      `INSERT INTO store_config (key, theme, is_dark, marquee_messages)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         theme            = EXCLUDED.theme,
         is_dark          = EXCLUDED.is_dark,
         marquee_messages = EXCLUDED.marquee_messages,
         updated_at       = NOW()
       RETURNING id, key, theme, is_dark, marquee_messages, created_at, updated_at`,
      [GLOBAL_KEY, data.theme ?? 'icy-silver', data.isDark ?? false, data.marqueeMessages ?? []],
    );

    return mapConfig(row!);
  }
}
