import { ISchemePlan, SchemeType } from '../domain/savings';
import { query, queryOne, queryRows, withTransaction } from '../infrastructure/postgres/pool';
import {
  toBigIntParam,
  toBool,
  toDate,
  toNum,
  toNumOrNull,
  toStrArray,
} from '../infrastructure/postgres/mapping';

export { ISchemePlan, SchemeType };

interface SchemePlanRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  is_active: boolean;
  metal: string | null;
  duration_months: number;
  bonus_months: number;
  passbook_prefix: string;
  payment_due_day_of_month: number | null;
  early_exit_penalty_percent: number | null;
  max_consecutive_missed_months: number | null;
  redemption_mode: string | null;
  gold_coin_purity: string | null;
  silver_coin_grams: number | null;
  gifts_value: number | null;
  gifts: string[] | null;
  sort_order: number;
  created_at: Date | null;
  updated_at: Date | null;
  monthly_amounts: unknown;
}

/**
 * The Diwali hamper was an embedded sub-document and is now four columns. It is
 * reassembled only when at least one of them is set, so a plan without a hamper
 * still reports `hamper: null` rather than an object full of nulls.
 */
const mapHamper = (row: SchemePlanRow): ISchemePlan['hamper'] => {
  const hasHamper =
    row.gold_coin_purity !== null ||
    row.silver_coin_grams !== null ||
    row.gifts_value !== null ||
    (Array.isArray(row.gifts) && row.gifts.length > 0);

  if (!hasHamper) return null;

  return {
    goldCoinPurity: row.gold_coin_purity,
    silverCoinGrams: toNumOrNull(row.silver_coin_grams),
    giftsValue: toNumOrNull(row.gifts_value),
    gifts: toStrArray(row.gifts),
  };
};

const mapPlan = (row: SchemePlanRow): ISchemePlan => ({
  _id: String(row.id),
  type: row.type as SchemeType,
  name: row.name,
  description: row.description,
  isActive: toBool(row.is_active, true),
  metal: (row.metal as ISchemePlan['metal']) ?? null,
  durationMonths: toNum(row.duration_months),
  bonusMonths: toNum(row.bonus_months),
  monthlyAmounts: Array.isArray(row.monthly_amounts)
    ? (row.monthly_amounts as unknown[]).map((v) => toNum(v))
    : [],
  passbookPrefix: row.passbook_prefix,
  paymentDueDayOfMonth: toNum(row.payment_due_day_of_month, 10),
  earlyExitPenaltyPercent: toNum(row.early_exit_penalty_percent, 10),
  maxConsecutiveMissedMonths: toNumOrNull(row.max_consecutive_missed_months),
  redemptionMode: (row.redemption_mode as ISchemePlan['redemptionMode']) ?? 'GOODS_ONLY',
  hamper: mapHamper(row),
  sortOrder: toNum(row.sort_order, 1),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

const SELECT = `
  SELECT
    p.id, p.type, p.name, p.description, p.is_active, p.metal, p.duration_months,
    p.bonus_months, p.passbook_prefix, p.payment_due_day_of_month,
    p.early_exit_penalty_percent, p.max_consecutive_missed_months, p.redemption_mode,
    p.gold_coin_purity, p.silver_coin_grams, p.gifts_value, p.gifts, p.sort_order,
    p.created_at, p.updated_at,
    COALESCE(
      (
        SELECT json_agg(a.amount::float8 ORDER BY a.sort_order, a.amount)
        FROM scheme_plan_monthly_amounts a
        WHERE a.scheme_plan_id = p.id
      ),
      '[]'::json
    ) AS monthly_amounts
  FROM scheme_plans p`;

/** Columns a caller may set, keyed by their domain field name. */
const COLUMNS: Record<string, string> = {
  type: 'type',
  name: 'name',
  description: 'description',
  isActive: 'is_active',
  metal: 'metal',
  durationMonths: 'duration_months',
  bonusMonths: 'bonus_months',
  passbookPrefix: 'passbook_prefix',
  paymentDueDayOfMonth: 'payment_due_day_of_month',
  earlyExitPenaltyPercent: 'early_exit_penalty_percent',
  maxConsecutiveMissedMonths: 'max_consecutive_missed_months',
  redemptionMode: 'redemption_mode',
  sortOrder: 'sort_order',
};

/** Flatten the nested hamper into its column assignments. */
const hamperColumns = (hamper: ISchemePlan['hamper']): Record<string, unknown> => {
  if (hamper === undefined) return {};
  if (hamper === null) {
    return {
      gold_coin_purity: null,
      silver_coin_grams: null,
      gifts_value: null,
      gifts: [],
    };
  }
  return {
    gold_coin_purity: hamper.goldCoinPurity ?? null,
    silver_coin_grams: hamper.silverCoinGrams ?? null,
    gifts_value: hamper.giftsValue ?? null,
    gifts: hamper.gifts ?? [],
  };
};

export class SchemePlanRepository {
  public async findActive(): Promise<ISchemePlan[]> {
    const rows = await queryRows<SchemePlanRow>(
      `${SELECT} WHERE p.is_active = TRUE ORDER BY p.sort_order ASC, p.name ASC`,
    );
    return rows.map(mapPlan);
  }

  public async findAll(): Promise<ISchemePlan[]> {
    const rows = await queryRows<SchemePlanRow>(`${SELECT} ORDER BY p.sort_order ASC, p.name ASC`);
    return rows.map(mapPlan);
  }

  public async findById(id: string): Promise<ISchemePlan | null> {
    const planId = toBigIntParam(id);
    if (!planId) return null;

    const row = await queryOne<SchemePlanRow>(`${SELECT} WHERE p.id = $1`, [planId]);
    return row ? mapPlan(row) : null;
  }

  public async findByType(type: SchemeType): Promise<ISchemePlan | null> {
    const row = await queryOne<SchemePlanRow>(`${SELECT} WHERE p.type = $1`, [type]);
    return row ? mapPlan(row) : null;
  }

  public async create(data: Partial<ISchemePlan>): Promise<ISchemePlan> {
    const planId = await withTransaction(async (client) => {
      const columns: Record<string, unknown> = {
        ...hamperColumns(data.hamper),
      };

      for (const [field, column] of Object.entries(COLUMNS)) {
        const value = (data as Record<string, unknown>)[field];
        if (value !== undefined) columns[column] = value;
      }

      const names = Object.keys(columns);
      const values = Object.values(columns);
      const placeholders = names.map((_, i) => `$${i + 1}`);

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO scheme_plans (${names.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING id`,
        values,
      );

      const id = String(inserted.rows[0].id);
      await this.replaceMonthlyAmounts(client, id, data.monthlyAmounts);
      return id;
    });

    const created = await this.findById(planId);
    if (!created) throw new Error('Scheme plan insert succeeded but the row could not be read back.');
    return created;
  }

  public async update(id: string, data: Partial<ISchemePlan>): Promise<ISchemePlan | null> {
    const planId = toBigIntParam(id);
    if (!planId) return null;

    const updated = await withTransaction(async (client) => {
      const existing = await client.query('SELECT id FROM scheme_plans WHERE id = $1 FOR UPDATE', [
        planId,
      ]);
      if (!existing.rowCount) return false;

      const columns: Record<string, unknown> = { ...hamperColumns(data.hamper) };
      for (const [field, column] of Object.entries(COLUMNS)) {
        const value = (data as Record<string, unknown>)[field];
        if (value !== undefined) columns[column] = value;
      }

      const assignments: string[] = [];
      const values: unknown[] = [];
      for (const [column, value] of Object.entries(columns)) {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      }

      if (assignments.length) {
        values.push(planId);
        await client.query(
          `UPDATE scheme_plans SET ${assignments.join(', ')}, updated_at = NOW()
           WHERE id = $${values.length}`,
          values,
        );
      }

      if (data.monthlyAmounts !== undefined) {
        await this.replaceMonthlyAmounts(client, planId, data.monthlyAmounts);
      }

      return true;
    });

    if (!updated) return null;
    return this.findById(id);
  }

  public async delete(id: string): Promise<boolean> {
    const planId = toBigIntParam(id);
    if (!planId) return false;

    return withTransaction(async (client) => {
      await client.query('DELETE FROM scheme_plan_monthly_amounts WHERE scheme_plan_id = $1', [
        planId,
      ]);
      const result = await client.query('DELETE FROM scheme_plans WHERE id = $1', [planId]);
      return (result.rowCount ?? 0) > 0;
    });
  }

  private async replaceMonthlyAmounts(
    client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
    planId: string,
    amounts: number[] | undefined,
  ): Promise<void> {
    await client.query('DELETE FROM scheme_plan_monthly_amounts WHERE scheme_plan_id = $1', [
      planId,
    ]);
    if (!Array.isArray(amounts)) return;

    // De-duplicated because (scheme_plan_id, amount) is unique — the Mongo array
    // tolerated repeats, so a payload with one is normalised rather than rejected.
    const unique = [...new Set(amounts.map((a) => Number(a)).filter((a) => Number.isFinite(a)))];

    for (const [index, amount] of unique.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO scheme_plan_monthly_amounts (scheme_plan_id, amount, sort_order)
         VALUES ($1, $2, $3)`,
        [planId, amount, index],
      );
    }
  }
}
