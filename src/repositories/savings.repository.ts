import { PoolClient } from 'pg';
import {
  ICancellation,
  IMaturityBenefits,
  ISavings,
  ISavingsPayment,
} from '../domain/savings';
import { queryOne, queryRows, withTransaction } from '../infrastructure/postgres/pool';
import { financialYearCode } from '../utils/time';
import {
  toBigIntParam,
  toDate,
  toNum,
  toNumOrNull,
  toStrArray,
} from '../infrastructure/postgres/mapping';

export { ISavings };

type PaymentRowPatch = Partial<
  Pick<
    ISavingsPayment,
    | 'amount'
    | 'paidAt'
    | 'materialRate'
    | 'materialWeight'
    | 'devidentAmount'
    | 'devidentMaterialRate'
    | 'devidentMaterialWeight'
  >
>;

interface SavingsRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  passbook_number: string | null;
  scheme_type: string;
  plan_id: string | null;
  metal: string | null;
  plan_name: string;
  monthly_amount: number;
  duration: number;
  bonus_amount: number;
  total_paid: number;
  status: string;
  start_date: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
  payments: unknown;
  cancellation: unknown;
  maturity_benefits: unknown;
}

/**
 * The ledger, ordered by id — insertion order, which is what the embedded
 * `payments` array preserved. Admin corrections address rows by index, so this
 * ordering is contract, not cosmetics.
 */
const PAYMENTS_JSON = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'month', sp.month,
          'amount', sp.amount::float8,
          'paidAt', sp.paid_at,
          'materialRate', sp.material_rate::float8,
          'materialWeight', sp.material_weight::float8,
          'devidentAmount', sp.devident_amount::float8,
          'devidentMaterialRate', sp.devident_material_rate::float8,
          'devidentMaterialWeight', sp.devident_material_weight::float8,
          'method', sp.method,
          'razorpayOrderId', sp.razorpay_order_id,
          'razorpayPaymentId', sp.razorpay_payment_id,
          'recordedBy', sp.recorded_by::text,
          'dueMonthKey', sp.due_month_key
        )
        ORDER BY sp.id
      )
      FROM savings_payments sp
      WHERE sp.savings_account_id = s.id
    ),
    '[]'::json
  ) AS payments`;

const CANCELLATION_JSON = `
  (
    SELECT json_build_object(
      'cancelledAt', sc.cancelled_at,
      'amountPaidAtCancellation', sc.amount_paid_at_cancellation::float8,
      'penaltyPercent', sc.penalty_percent::float8,
      'penaltyAmount', sc.penalty_amount::float8,
      'giftsValueDeducted', sc.gifts_value_deducted::float8,
      'netRedeemable', sc.net_redeemable::float8,
      'note', sc.note,
      'cancelledBy', sc.cancelled_by::text
    )
    FROM savings_cancellations sc
    WHERE sc.savings_account_id = s.id
  ) AS cancellation`;

const MATURITY_JSON = `
  (
    SELECT json_build_object(
      'goldCoinValue', mb.gold_coin_value::float8,
      'goldGrams', mb.gold_grams::float8,
      'goldRatePerGram', mb.gold_rate_per_gram::float8,
      'silverGrams', mb.silver_grams::float8,
      'silverValue', mb.silver_value::float8,
      'silverRatePerGram', mb.silver_rate_per_gram::float8,
      'giftsValue', mb.gifts_value::float8,
      'gifts', mb.gifts,
      'computedAt', mb.computed_at
    )
    FROM savings_maturity_benefits mb
    WHERE mb.savings_account_id = s.id
  ) AS maturity_benefits`;

const SAVINGS_COLUMNS = `
  s.id, s.user_id, s.passbook_number, s.scheme_type, s.plan_id, s.metal, s.plan_name,
  s.monthly_amount, s.duration, s.bonus_amount, s.total_paid, s.status, s.start_date,
  s.created_at, s.updated_at`;

const SAVINGS_SELECT = `
  SELECT ${SAVINGS_COLUMNS},
         NULL::text AS user_name, NULL::text AS user_email, NULL::text AS user_phone,
         ${PAYMENTS_JSON}, ${CANCELLATION_JSON}, ${MATURITY_JSON}
  FROM savings_accounts s`;

/** With the owner joined — the SQL equivalent of `populate('userId', ...)`. */
const SAVINGS_SELECT_WITH_USER = `
  SELECT ${SAVINGS_COLUMNS},
         u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
         ${PAYMENTS_JSON}, ${CANCELLATION_JSON}, ${MATURITY_JSON}
  FROM savings_accounts s
  LEFT JOIN users u ON u.id = s.user_id`;

const mapPayment = (raw: Record<string, any>): ISavingsPayment => ({
  month: toNum(raw.month),
  amount: toNum(raw.amount),
  paidAt: toDate(raw.paidAt) ?? new Date(0),
  materialRate: toNum(raw.materialRate),
  materialWeight: toNum(raw.materialWeight),
  devidentAmount: toNum(raw.devidentAmount),
  devidentMaterialRate: toNum(raw.devidentMaterialRate),
  devidentMaterialWeight: toNum(raw.devidentMaterialWeight),
  method: raw.method === 'CASH' ? 'CASH' : 'ONLINE',
  razorpayOrderId: raw.razorpayOrderId ?? null,
  razorpayPaymentId: raw.razorpayPaymentId ?? null,
  recordedBy: raw.recordedBy ?? null,
  dueMonthKey: raw.dueMonthKey ?? null,
});

const mapCancellation = (raw: unknown): ICancellation | null => {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, any>;
  return {
    cancelledAt: toDate(c.cancelledAt) ?? new Date(0),
    amountPaidAtCancellation: toNum(c.amountPaidAtCancellation),
    penaltyPercent: toNum(c.penaltyPercent),
    penaltyAmount: toNum(c.penaltyAmount),
    giftsValueDeducted: toNum(c.giftsValueDeducted),
    netRedeemable: toNum(c.netRedeemable),
    note: c.note ?? null,
    cancelledBy: String(c.cancelledBy ?? ''),
  };
};

const mapMaturity = (raw: unknown): IMaturityBenefits | null => {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, any>;
  return {
    goldCoinValue: toNumOrNull(m.goldCoinValue),
    goldGrams: toNumOrNull(m.goldGrams),
    goldRatePerGram: toNumOrNull(m.goldRatePerGram),
    silverGrams: toNumOrNull(m.silverGrams),
    silverValue: toNumOrNull(m.silverValue),
    silverRatePerGram: toNumOrNull(m.silverRatePerGram),
    giftsValue: toNumOrNull(m.giftsValue),
    gifts: toStrArray(m.gifts),
    computedAt: toDate(m.computedAt),
  };
};

const mapSavings = (row: SavingsRow): ISavings => ({
  _id: String(row.id),
  userId:
    row.user_name !== null || row.user_email !== null || row.user_phone !== null
      ? {
          _id: String(row.user_id),
          name: row.user_name ?? '',
          email: row.user_email ?? '',
          phone: row.user_phone,
        }
      : String(row.user_id),
  passbookNumber: row.passbook_number,
  schemeType: row.scheme_type as ISavings['schemeType'],
  planId: row.plan_id === null ? null : String(row.plan_id),
  metal: (row.metal as ISavings['metal']) ?? null,
  planName: row.plan_name,
  monthlyAmount: toNum(row.monthly_amount),
  duration: toNum(row.duration),
  bonusAmount: toNum(row.bonus_amount),
  totalPaid: toNum(row.total_paid),
  status: row.status as ISavings['status'],
  payments: Array.isArray(row.payments)
    ? (row.payments as Record<string, any>[]).map(mapPayment)
    : [],
  maturityBenefits: mapMaturity(row.maturity_benefits),
  cancellation: mapCancellation(row.cancellation),
  startDate: toDate(row.start_date) ?? new Date(0),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

/** Columns a caller may set through `updateById`. */
const UPDATABLE_COLUMNS: Record<string, string> = {
  passbookNumber: 'passbook_number',
  schemeType: 'scheme_type',
  planId: 'plan_id',
  metal: 'metal',
  planName: 'plan_name',
  monthlyAmount: 'monthly_amount',
  duration: 'duration',
  bonusAmount: 'bonus_amount',
  totalPaid: 'total_paid',
  status: 'status',
  startDate: 'start_date',
};

export class SavingsRepository {
  /**
   * Only used once a scheme's first payment lands (see `recordPayment`) — enrollment
   * alone no longer mints a passbook number. `passbook_number` is nullable-unique
   * precisely so a fresh enrollment can sit with it unset.
   *
   * Format is per-scheme-type: `{prefix}-{financialYearCode}-{7-digit seq}`, e.g.
   * 'GLD-2425-0000012'. The sequence counts only passbooks already issued under that same
   * prefix (not reset per financial year, not shared across scheme types). Pre-rework
   * passbooks minted without a prefix (bare `2425-0000111`) are untouched and excluded from
   * every prefix's count.
   *
   * The caller holds a transaction-scoped advisory lock keyed on the prefix, so
   * two first payments landing at once cannot mint the same number and trip the
   * unique constraint (spec §26).
   */
  public async generatePassbookNumber(prefix: string, client?: PoolClient): Promise<string> {
    const sql =
      'SELECT count(*)::int AS count FROM savings_accounts WHERE passbook_number LIKE $1';
    const params = [`${prefix}-%`];

    // Runs on the caller's client when it is minting inside recordPayment's
    // transaction (so the advisory lock actually covers the count), and on the
    // pool otherwise.
    const count = client
      ? toNum((await client.query<{ count: number }>(sql, params)).rows[0]?.count)
      : toNum((await queryOne<{ count: number }>(sql, params))?.count);

    const seq = (count + 1).toString().padStart(7, '0');
    return `${prefix}-${financialYearCode(new Date())}-${seq}`;
  }

  public async create(data: any): Promise<ISavings> {
    const userId = toBigIntParam(data.user || data.userId);
    if (!userId) throw new Error(`Invalid user id: ${data.user ?? data.userId}`);

    const schemeId = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO savings_accounts
           (user_id, scheme_type, plan_id, metal, plan_name, monthly_amount, duration,
            bonus_amount, total_paid, status, start_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          userId,
          // passbook_number intentionally omitted — a real passbook is only
          // issued once this customer makes their first actual payment.
          data.schemeType || 'SILVER_11_1',
          toBigIntParam(data.planId),
          data.metal ?? null,
          String(data.planName || 'Silver Savings'),
          Number(data.monthlyAmount || 0),
          Number(data.duration || 11),
          Number(data.bonusAmount || 0),
          Number(data.totalPaid || 0),
          'Active',
          data.startDate || new Date(),
        ],
      );

      const id = String(inserted.rows[0].id);

      if (data.maturityBenefits) {
        await this.writeMaturityBenefits(client, id, data.maturityBenefits);
      }

      return id;
    });

    const created = await this.findById(schemeId);
    if (!created) throw new Error('Savings insert succeeded but the row could not be read back.');
    return created;
  }

  public async findByUserId(userId: string): Promise<ISavings[]> {
    const ownerId = toBigIntParam(userId);
    if (!ownerId) return [];

    const rows = await queryRows<SavingsRow>(
      `${SAVINGS_SELECT} WHERE s.user_id = $1 ORDER BY s.created_at DESC, s.id DESC`,
      [ownerId],
    );
    return rows.map(mapSavings);
  }

  public async findAll(): Promise<ISavings[]> {
    const rows = await queryRows<SavingsRow>(
      `${SAVINGS_SELECT_WITH_USER} ORDER BY s.created_at DESC, s.id DESC`,
    );
    return rows.map(mapSavings);
  }

  /** Active schemes with the owner's phone populated — used by the daily reminder cron. */
  public async findActiveWithUserPhone(): Promise<ISavings[]> {
    const rows = await queryRows<SavingsRow>(
      `${SAVINGS_SELECT_WITH_USER} WHERE s.status = 'Active' ORDER BY s.id`,
    );
    return rows.map(mapSavings);
  }

  /** Reminder cron: active schemes of a given type, owner phone populated. */
  public async findActiveByTypeWithUserPhone(
    schemeType: ISavings['schemeType'],
  ): Promise<ISavings[]> {
    const rows = await queryRows<SavingsRow>(
      `${SAVINGS_SELECT_WITH_USER} WHERE s.status = 'Active' AND s.scheme_type = $1 ORDER BY s.id`,
      [schemeType],
    );
    return rows.map(mapSavings);
  }

  public async findById(id: string): Promise<ISavings | null> {
    const schemeId = toBigIntParam(id);
    if (!schemeId) return null;

    const row = await queryOne<SavingsRow>(`${SAVINGS_SELECT} WHERE s.id = $1`, [schemeId]);
    return row ? mapSavings(row) : null;
  }

  public async findByPassbookNumber(passbookNumber: string): Promise<ISavings | null> {
    const row = await queryOne<SavingsRow>(`${SAVINGS_SELECT} WHERE s.passbook_number = $1`, [
      String(passbookNumber ?? '').trim().toUpperCase(),
    ]);
    return row ? mapSavings(row) : null;
  }

  public async updateById(id: string, data: Partial<ISavings>): Promise<ISavings | null> {
    const schemeId = toBigIntParam(id);
    if (!schemeId) return null;

    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
      const value = (data as Record<string, unknown>)[field];
      if (value === undefined) continue;

      values.push(field === 'planId' ? toBigIntParam(value) : value);
      assignments.push(`${column} = $${values.length}`);
    }

    if (assignments.length) {
      values.push(schemeId);
      const result = await queryOne<{ id: string }>(
        `UPDATE savings_accounts SET ${assignments.join(', ')}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING id`,
        values,
      );
      if (!result) return null;
    }

    if (data.maturityBenefits !== undefined) {
      await withTransaction((client) =>
        this.writeMaturityBenefits(client, schemeId, data.maturityBenefits ?? null),
      );
    }

    return this.findById(id);
  }

  public async deleteById(id: string): Promise<ISavings | null> {
    const schemeId = toBigIntParam(id);
    if (!schemeId) return null;

    const existing = await this.findById(schemeId);
    if (!existing) return null;

    // No ON DELETE CASCADE on the children, so they go first.
    await withTransaction(async (client) => {
      await client.query('DELETE FROM savings_payments WHERE savings_account_id = $1', [schemeId]);
      await client.query('DELETE FROM savings_cancellations WHERE savings_account_id = $1', [
        schemeId,
      ]);
      await client.query('DELETE FROM savings_maturity_benefits WHERE savings_account_id = $1', [
        schemeId,
      ]);
      await client.query('DELETE FROM savings_accounts WHERE id = $1', [schemeId]);
    });

    return existing;
  }

  /**
   * `assignPassbook` is set by the caller (SavingsService) when this is the scheme's
   * first-ever payment and it doesn't already have a passbook number — that's the one
   * moment a real passbook is minted, using this scheme's `passbookPrefix`.
   * `materialRate`/`materialWeight` are already resolved by the caller (live rate for the
   * scheme's metal, or an admin override) — this method just persists them.
   *
   * The ledger row, the running total and the passbook assignment are one
   * transaction: a partially applied installment would leave `total_paid`
   * disagreeing with the rows that justify it (spec §26).
   */
  public async recordPayment(
    schemeId: string,
    row: {
      month: number;
      amount: number;
      materialRate: number;
      materialWeight: number;
      method: 'ONLINE' | 'CASH';
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      recordedBy?: string;
      dueMonthKey: string;
    },
    assignPassbook = false,
    passbookPrefix?: string,
  ): Promise<ISavings | null> {
    const id = toBigIntParam(schemeId);
    if (!id) return null;

    const applied = await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT id FROM savings_accounts WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!existing.rowCount) return false;

      await client.query(
        `INSERT INTO savings_payments
           (savings_account_id, month, amount, paid_at, material_rate, material_weight,
            devident_amount, devident_material_rate, devident_material_weight,
            method, razorpay_order_id, razorpay_payment_id, recorded_by, due_month_key)
         VALUES ($1,$2,$3,NOW(),$4,$5,0,0,0,$6,$7,$8,$9,$10)`,
        [
          id,
          row.month,
          row.amount,
          row.materialRate,
          row.materialWeight,
          row.method,
          row.razorpayOrderId ?? null,
          row.razorpayPaymentId ?? null,
          toBigIntParam(row.recordedBy),
          row.dueMonthKey,
        ],
      );

      await client.query(
        'UPDATE savings_accounts SET total_paid = total_paid + $2, updated_at = NOW() WHERE id = $1',
        [id, row.amount],
      );

      if (assignPassbook) {
        const prefix = passbookPrefix || 'PB';
        // Serialise passbook minting for this prefix across concurrent callers.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`passbook:${prefix}`]);
        const passbookNumber = await this.generatePassbookNumber(prefix, client);
        await client.query('UPDATE savings_accounts SET passbook_number = $2 WHERE id = $1', [
          id,
          passbookNumber,
        ]);
      }

      return true;
    });

    if (!applied) return null;
    return this.findById(schemeId);
  }

  /**
   * Appends the automatic bonus-month ledger row (no real collection — `amount`/
   * `materialRate`/`materialWeight` are all 0) and marks the scheme Completed. Called once,
   * right after a scheme's Nth real payment (N = plan.durationMonths) — see
   * SavingsService.applyPayment.
   */
  public async creditBonusMonth(
    schemeId: string,
    row: {
      month: number;
      devidentAmount: number;
      devidentMaterialRate: number;
      devidentMaterialWeight: number;
    },
  ): Promise<ISavings | null> {
    const id = toBigIntParam(schemeId);
    if (!id) return null;

    const applied = await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT id FROM savings_accounts WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!existing.rowCount) return false;

      await client.query(
        `INSERT INTO savings_payments
           (savings_account_id, month, amount, paid_at, material_rate, material_weight,
            devident_amount, devident_material_rate, devident_material_weight, method)
         VALUES ($1,$2,0,NOW(),0,0,$3,$4,$5,'ONLINE')`,
        [id, row.month, row.devidentAmount, row.devidentMaterialRate, row.devidentMaterialWeight],
      );

      await client.query(
        `UPDATE savings_accounts SET status = 'Completed', updated_at = NOW() WHERE id = $1`,
        [id],
      );

      return true;
    });

    if (!applied) return null;
    return this.findById(schemeId);
  }

  /**
   * Admin-only correction of a single ledger row (see `/admin/savings/:id/payments/:index`).
   * `index` is the position in the ordered ledger, which is how the admin UI
   * addresses rows; it is resolved to a row id inside the transaction.
   */
  public async updatePaymentRow(
    schemeId: string,
    index: number,
    patch: PaymentRowPatch,
  ): Promise<ISavings | null> {
    const id = toBigIntParam(schemeId);
    if (!id) return null;

    const applied = await withTransaction(async (client) => {
      await client.query('SELECT id FROM savings_accounts WHERE id = $1 FOR UPDATE', [id]);

      const target = await client.query<{ id: string; amount: number }>(
        `SELECT id, amount FROM savings_payments
         WHERE savings_account_id = $1
         ORDER BY id
         OFFSET $2 LIMIT 1`,
        [id, index],
      );
      if (!target.rowCount) return false;

      const rowId = String(target.rows[0].id);
      const oldAmount = toNum(target.rows[0].amount);

      const columns: Record<string, unknown> = {
        amount: patch.amount,
        paid_at: patch.paidAt,
        material_rate: patch.materialRate,
        material_weight: patch.materialWeight,
        devident_amount: patch.devidentAmount,
        devident_material_rate: patch.devidentMaterialRate,
        devident_material_weight: patch.devidentMaterialWeight,
      };

      const assignments: string[] = [];
      const values: unknown[] = [];
      for (const [column, value] of Object.entries(columns)) {
        if (value === undefined) continue;
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      }

      if (assignments.length) {
        values.push(rowId);
        await client.query(
          `UPDATE savings_payments SET ${assignments.join(', ')}, updated_at = NOW()
           WHERE id = $${values.length}`,
          values,
        );
      }

      // Keep the running total consistent with the corrected row.
      if (patch.amount !== undefined) {
        await client.query(
          'UPDATE savings_accounts SET total_paid = total_paid - $2 + $3, updated_at = NOW() WHERE id = $1',
          [id, oldAmount, patch.amount],
        );
      }

      return true;
    });

    if (!applied) return null;
    return this.findById(schemeId);
  }

  /** Admin-only removal of an erroneous ledger row. */
  public async deletePaymentRow(schemeId: string, index: number): Promise<ISavings | null> {
    const id = toBigIntParam(schemeId);
    if (!id) return null;

    const applied = await withTransaction(async (client) => {
      await client.query('SELECT id FROM savings_accounts WHERE id = $1 FOR UPDATE', [id]);

      const target = await client.query<{ id: string; amount: number }>(
        `SELECT id, amount FROM savings_payments
         WHERE savings_account_id = $1
         ORDER BY id
         OFFSET $2 LIMIT 1`,
        [id, index],
      );
      if (!target.rowCount) return false;

      await client.query('DELETE FROM savings_payments WHERE id = $1', [
        String(target.rows[0].id),
      ]);

      // GREATEST clamps at zero, matching the previous Math.max(0, ...).
      await client.query(
        'UPDATE savings_accounts SET total_paid = GREATEST(0, total_paid - $2), updated_at = NOW() WHERE id = $1',
        [id, toNum(target.rows[0].amount)],
      );

      return true;
    });

    if (!applied) return null;
    return this.findById(schemeId);
  }

  public async getPayments(schemeId: string): Promise<ISavingsPayment[]> {
    const scheme = await this.findById(schemeId);
    return scheme ? scheme.payments : [];
  }

  /** Card rule 6 (early exit): records the forfeit/redeemable split and cancels the scheme. */
  public async cancelScheme(
    schemeId: string,
    cancellation: ICancellation,
  ): Promise<ISavings | null> {
    const id = toBigIntParam(schemeId);
    if (!id) return null;

    const applied = await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT id FROM savings_accounts WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!existing.rowCount) return false;

      await client.query(
        `INSERT INTO savings_cancellations
           (savings_account_id, cancelled_at, amount_paid_at_cancellation, penalty_percent,
            penalty_amount, gifts_value_deducted, net_redeemable, note, cancelled_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (savings_account_id) DO UPDATE SET
           cancelled_at = EXCLUDED.cancelled_at,
           amount_paid_at_cancellation = EXCLUDED.amount_paid_at_cancellation,
           penalty_percent = EXCLUDED.penalty_percent,
           penalty_amount = EXCLUDED.penalty_amount,
           gifts_value_deducted = EXCLUDED.gifts_value_deducted,
           net_redeemable = EXCLUDED.net_redeemable,
           note = EXCLUDED.note,
           cancelled_by = EXCLUDED.cancelled_by,
           updated_at = NOW()`,
        [
          id,
          cancellation.cancelledAt ?? new Date(),
          cancellation.amountPaidAtCancellation,
          cancellation.penaltyPercent,
          cancellation.penaltyAmount,
          cancellation.giftsValueDeducted ?? 0,
          cancellation.netRedeemable,
          cancellation.note ?? null,
          toBigIntParam(cancellation.cancelledBy),
        ],
      );

      await client.query(
        `UPDATE savings_accounts SET status = 'Cancelled', updated_at = NOW() WHERE id = $1`,
        [id],
      );

      return true;
    });

    if (!applied) return null;
    return this.findById(schemeId);
  }

  /**
   * Diwali-only: persists the computed redemption payout (gold value/grams, silver value,
   * gifts value) onto maturityBenefits once the scheme has completed all installments.
   */
  public async setMaturityBenefits(
    schemeId: string,
    maturityBenefits: IMaturityBenefits,
  ): Promise<ISavings | null> {
    const id = toBigIntParam(schemeId);
    if (!id) return null;

    const existing = await this.findById(id);
    if (!existing) return null;

    await withTransaction((client) => this.writeMaturityBenefits(client, id, maturityBenefits));
    return this.findById(schemeId);
  }

  private async writeMaturityBenefits(
    client: PoolClient,
    schemeId: string,
    benefits: IMaturityBenefits | null,
  ): Promise<void> {
    if (benefits === null) {
      await client.query('DELETE FROM savings_maturity_benefits WHERE savings_account_id = $1', [
        schemeId,
      ]);
      return;
    }

    await client.query(
      `INSERT INTO savings_maturity_benefits
         (savings_account_id, gold_coin_value, gold_grams, gold_rate_per_gram,
          silver_grams, silver_value, silver_rate_per_gram, gifts_value, gifts, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (savings_account_id) DO UPDATE SET
         gold_coin_value = EXCLUDED.gold_coin_value,
         gold_grams = EXCLUDED.gold_grams,
         gold_rate_per_gram = EXCLUDED.gold_rate_per_gram,
         silver_grams = EXCLUDED.silver_grams,
         silver_value = EXCLUDED.silver_value,
         silver_rate_per_gram = EXCLUDED.silver_rate_per_gram,
         gifts_value = EXCLUDED.gifts_value,
         gifts = EXCLUDED.gifts,
         computed_at = EXCLUDED.computed_at,
         updated_at = NOW()`,
      [
        schemeId,
        benefits.goldCoinValue ?? null,
        benefits.goldGrams ?? null,
        benefits.goldRatePerGram ?? null,
        benefits.silverGrams ?? null,
        benefits.silverValue ?? null,
        benefits.silverRatePerGram ?? null,
        benefits.giftsValue ?? null,
        benefits.gifts ?? [],
        benefits.computedAt ?? null,
      ],
    );
  }
}
