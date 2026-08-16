import { IFilterConfig, IPriceRange } from '../domain/config';
import { queryOne, withTransaction } from '../infrastructure/postgres/pool';
import { toDate, toStrArray } from '../infrastructure/postgres/mapping';

export { IFilterConfig, IPriceRange };

const GLOBAL_KEY = 'global';

interface FilterConfigRow {
  id: string;
  key: string;
  hidden_categories: string[] | null;
  metals: string[] | null;
  created_at: Date | null;
  updated_at: Date | null;
  price_ranges: unknown;
}

/**
 * `priceRanges` was an embedded array and is now the `filter_price_ranges`
 * child table. It is aggregated back into the nested array the admin UI reads,
 * ordered by the stored sort order so an admin's arrangement survives a
 * round trip.
 */
const SELECT = `
  SELECT
    f.id, f.key, f.hidden_categories, f.metals, f.created_at, f.updated_at,
    COALESCE(
      (
        SELECT json_agg(json_build_object('label', r.label, 'value', r.value) ORDER BY r.sort_order, r.id)
        FROM filter_price_ranges r
        WHERE r.filter_config_id = f.id
      ),
      '[]'::json
    ) AS price_ranges
  FROM filter_config f`;

const mapConfig = (row: FilterConfigRow): IFilterConfig => ({
  _id: String(row.id),
  key: row.key,
  hiddenCategories: toStrArray(row.hidden_categories),
  metals: toStrArray(row.metals),
  priceRanges: Array.isArray(row.price_ranges)
    ? (row.price_ranges as Record<string, unknown>[]).map((r) => ({
        label: String(r.label ?? ''),
        value: String(r.value ?? ''),
      }))
    : [],
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

export class FilterConfigRepository {
  public async get(): Promise<IFilterConfig | null> {
    const row = await queryOne<FilterConfigRow>(`${SELECT} WHERE f.key = $1`, [GLOBAL_KEY]);
    return row ? mapConfig(row) : null;
  }

  public async upsert(data: {
    hiddenCategories?: string[];
    metals?: string[];
    priceRanges?: { label: string; value: string }[];
  }): Promise<IFilterConfig> {
    // The config row and its price ranges are rewritten together — a partial
    // apply would leave the admin looking at ranges that no longer match the
    // rest of the config.
    await withTransaction(async (client) => {
      const upserted = await client.query<{ id: string }>(
        `INSERT INTO filter_config (key, hidden_categories, metals)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET
           hidden_categories = EXCLUDED.hidden_categories,
           metals            = EXCLUDED.metals,
           updated_at        = NOW()
         RETURNING id`,
        [GLOBAL_KEY, data.hiddenCategories ?? [], data.metals ?? []],
      );

      const configId = String(upserted.rows[0].id);

      await client.query('DELETE FROM filter_price_ranges WHERE filter_config_id = $1', [configId]);

      const ranges = data.priceRanges ?? [];
      for (const [index, range] of ranges.entries()) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO filter_price_ranges (filter_config_id, label, value, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [configId, range.label, range.value, index],
        );
      }
    });

    const config = await this.get();
    if (!config) throw new Error('Filter config upsert succeeded but the row could not be read back.');
    return config;
  }
}
