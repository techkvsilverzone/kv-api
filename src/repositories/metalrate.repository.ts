import { IMetalRate, MetalType } from '../domain/rates';
import { query, queryOne, queryRows } from '../infrastructure/postgres/pool';
import { istDayKey, istMidnightUtc } from '../utils/time';
import { toDate, toNum } from '../infrastructure/postgres/mapping';

export { IMetalRate, MetalType };

export interface MetalRateUpsertParams {
  date: Date;
  metal: MetalType;
  karat: number | null;
  ratePerGram: number;
  updatedBy?: string;
}

interface MetalRateRow {
  id: string;
  rate_date: string;
  metal: string;
  karat: number | null;
  rate_per_gram: number;
  rate_per_kg: number;
  updated_by: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

/**
 * `rate_date` is a DATE holding an IST calendar day. It is surfaced as the UTC
 * instant of that day's IST midnight — identical to what the Mongo column held,
 * so every downstream freshness check keeps working unchanged.
 */
const mapRate = (row: MetalRateRow): IMetalRate => ({
  _id: String(row.id),
  date: istMidnightUtc(String(row.rate_date)),
  metal: row.metal as MetalType,
  karat: row.karat === null || row.karat === undefined ? null : toNum(row.karat),
  ratePerGram: toNum(row.rate_per_gram),
  ratePerKg: toNum(row.rate_per_kg),
  updatedBy: row.updated_by,
  createdAt: toDate(row.created_at) ?? new Date(0),
  updatedAt: toDate(row.updated_at) ?? new Date(0),
});

const RATE_SELECT = `
  SELECT id, rate_date, metal, karat, rate_per_gram, rate_per_kg, updated_by,
         created_at, updated_at
  FROM metal_rates`;

/**
 * `ORDER BY metal DESC` reproduces Mongo's `sort({ metal: -1 })`, which put
 * SILVER ahead of GOLD. The API's rate lists are ordered, so this is contract.
 */
const RATE_ORDER = 'ORDER BY rate_date DESC, metal DESC, karat ASC NULLS FIRST';

export class MetalRateRepository {
  public async findToday(metal?: MetalType): Promise<IMetalRate[]> {
    const conditions = ['rate_date = $1'];
    const values: unknown[] = [istDayKey()];

    if (metal) {
      values.push(metal);
      conditions.push(`metal = $${values.length}`);
    }

    const rows = await queryRows<MetalRateRow>(
      `${RATE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY metal DESC, karat ASC NULLS FIRST`,
      values,
    );
    return rows.map(mapRate);
  }

  public async findHistory(days: number, metal?: MetalType): Promise<IMetalRate[]> {
    const todayKey = istDayKey();
    const fromKey = istDayKey(
      new Date(istMidnightUtc(todayKey).getTime() - days * 24 * 60 * 60 * 1000),
    );

    const conditions = ['rate_date >= $1'];
    const values: unknown[] = [fromKey];

    if (metal) {
      values.push(metal);
      conditions.push(`metal = $${values.length}`);
    }

    const rows = await queryRows<MetalRateRow>(
      `${RATE_SELECT} WHERE ${conditions.join(' AND ')} ${RATE_ORDER}`,
      values,
    );
    return rows.map(mapRate);
  }

  public async findAll(metal?: MetalType): Promise<IMetalRate[]> {
    const values: unknown[] = [];
    let where = '';

    if (metal) {
      values.push(metal);
      where = `WHERE metal = $${values.length}`;
    }

    const rows = await queryRows<MetalRateRow>(`${RATE_SELECT} ${where} ${RATE_ORDER}`, values);
    return rows.map(mapRate);
  }

  /** Most recent rate record for a metal (by date desc), or null if none exists. */
  public async findLatest(metal: MetalType): Promise<IMetalRate | null> {
    const row = await queryOne<MetalRateRow>(
      `${RATE_SELECT} WHERE metal = $1 ORDER BY rate_date DESC, id DESC LIMIT 1`,
      [metal],
    );
    return row ? mapRate(row) : null;
  }

  public async upsertRate(params: MetalRateUpsertParams): Promise<IMetalRate> {
    // The service pins params.date to IST midnight, which in UTC lands on the
    // PREVIOUS calendar day (18:30Z). Deriving the key with istDayKey rather
    // than slicing the ISO string is what keeps the rate on the intended IST
    // day — a plain toISOString().slice(0,10) here would store it a day early.
    const dayKey = istDayKey(params.date);
    const ratePerKg = params.ratePerGram * 1000;

    // The unique index is on (rate_date, metal, COALESCE(karat, -1)), so the
    // conflict target has to restate that expression to be matched.
    const row = await queryOne<MetalRateRow>(
      `INSERT INTO metal_rates (rate_date, metal, karat, rate_per_gram, rate_per_kg, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (rate_date, metal, COALESCE(karat, -1)) DO UPDATE SET
         rate_per_gram = EXCLUDED.rate_per_gram,
         rate_per_kg   = EXCLUDED.rate_per_kg,
         updated_by    = EXCLUDED.updated_by,
         updated_at    = NOW()
       RETURNING id, rate_date, metal, karat, rate_per_gram, rate_per_kg, updated_by,
                 created_at, updated_at`,
      [dayKey, params.metal, params.karat, params.ratePerGram, ratePerKg, params.updatedBy ?? null],
    );

    return mapRate(row!);
  }
}
