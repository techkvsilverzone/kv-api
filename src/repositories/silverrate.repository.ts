import { ISilverRate } from '../domain/rates';
import { queryOne, queryRows } from '../infrastructure/postgres/pool';
import { istDayKey, istMidnightUtc } from '../utils/time';
import { toDate, toNum } from '../infrastructure/postgres/mapping';

export { ISilverRate };

interface SilverRateRow {
  id: string;
  rate_date: string;
  purity: string;
  rate_per_gram: number;
  rate_per_kg: number;
  updated_by: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

const mapRate = (row: SilverRateRow): ISilverRate => ({
  _id: String(row.id),
  rateDate: istMidnightUtc(String(row.rate_date)),
  purity: row.purity as ISilverRate['purity'],
  ratePerGram: toNum(row.rate_per_gram),
  ratePerKg: toNum(row.rate_per_kg),
  updatedBy: row.updated_by,
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

const RATE_SELECT = `
  SELECT id, rate_date, purity, rate_per_gram, rate_per_kg, updated_by, created_at, updated_at
  FROM silver_rates`;

/**
 * Legacy standalone silver-rate table. The live silver endpoints delegate to
 * MetalRate; this repository is retained because the routes that read it are
 * still mounted (spec §22 — a domain is not dropped just because it is quiet).
 *
 * "Today" is now the IST calendar day rather than the server's local day. The
 * Mongo implementation used `setHours(0,0,0,0)`, which silently drifted on a
 * non-IST server; pinning to IST matches how every other rate in the system
 * already decides what day it is.
 */
export class SilverRateRepository {
  public async findToday(): Promise<ISilverRate[]> {
    const rows = await queryRows<SilverRateRow>(
      `${RATE_SELECT} WHERE rate_date = $1 ORDER BY purity ASC`,
      [istDayKey()],
    );
    return rows.map(mapRate);
  }

  public async findHistory(days: number): Promise<ISilverRate[]> {
    const fromKey = istDayKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

    const rows = await queryRows<SilverRateRow>(
      `${RATE_SELECT} WHERE rate_date >= $1 ORDER BY rate_date DESC, purity ASC`,
      [fromKey],
    );
    return rows.map(mapRate);
  }

  public async findAll(): Promise<ISilverRate[]> {
    const rows = await queryRows<SilverRateRow>(
      `${RATE_SELECT} ORDER BY rate_date DESC, purity ASC`,
    );
    return rows.map(mapRate);
  }

  public async upsertTodayRate(
    ratePerGram: number,
    purity: ISilverRate['purity'],
    updatedBy?: string,
  ): Promise<ISilverRate> {
    const ratePerKg = ratePerGram * 1000;

    const row = await queryOne<SilverRateRow>(
      `INSERT INTO silver_rates (rate_date, purity, rate_per_gram, rate_per_kg, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (rate_date, purity) DO UPDATE SET
         rate_per_gram = EXCLUDED.rate_per_gram,
         rate_per_kg   = EXCLUDED.rate_per_kg,
         updated_by    = EXCLUDED.updated_by,
         updated_at    = NOW()
       RETURNING id, rate_date, purity, rate_per_gram, rate_per_kg, updated_by,
                 created_at, updated_at`,
      [istDayKey(), purity, ratePerGram, ratePerKg, updatedBy ?? null],
    );

    return mapRate(row!);
  }
}
