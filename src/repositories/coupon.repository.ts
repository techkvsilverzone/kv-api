import { ICoupon } from '../domain/commerce';
import { query, queryOne, queryRows } from '../infrastructure/postgres/pool';
import { toBigIntParam, toBool, toDate, toNum } from '../infrastructure/postgres/mapping';

export { ICoupon };

interface CouponRow {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  max_uses: number;
  used_count: number;
  expiry_date: Date | null;
  is_active: boolean;
  created_at: Date | null;
  updated_at: Date | null;
}

/**
 * `maxUses` of 0 means unlimited and is stored as a literal 0 — never NULL
 * (spec §24). `toNum(..., 0)` therefore also treats an unexpected NULL as
 * unlimited rather than inventing a limit.
 */
const mapCoupon = (row: CouponRow): ICoupon => ({
  _id: String(row.id),
  code: row.code,
  discountType: row.discount_type === 'percentage' ? 'percentage' : 'fixed',
  discountValue: toNum(row.discount_value),
  minOrderAmount: toNum(row.min_order_amount),
  maxUses: toNum(row.max_uses, 0),
  usedCount: toNum(row.used_count),
  expiryDate: toDate(row.expiry_date) ?? new Date(0),
  isActive: toBool(row.is_active, true),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

const SELECT = `
  SELECT id, code, discount_type, discount_value, min_order_amount, max_uses,
         used_count, expiry_date, is_active, created_at, updated_at
  FROM coupons`;

const RETURNING = `
  RETURNING id, code, discount_type, discount_value, min_order_amount, max_uses,
            used_count, expiry_date, is_active, created_at, updated_at`;

/** Columns a caller may set through `update`, keyed by their domain field name. */
const UPDATABLE_COLUMNS: Record<string, string> = {
  code: 'code',
  discountType: 'discount_type',
  discountValue: 'discount_value',
  minOrderAmount: 'min_order_amount',
  maxUses: 'max_uses',
  usedCount: 'used_count',
  expiryDate: 'expiry_date',
  isActive: 'is_active',
};

export class CouponRepository {
  public async findAll(): Promise<ICoupon[]> {
    const rows = await queryRows<CouponRow>(`${SELECT} ORDER BY created_at DESC, id DESC`);
    return rows.map(mapCoupon);
  }

  public async findByCode(code: string): Promise<ICoupon | null> {
    const row = await queryOne<CouponRow>(`${SELECT} WHERE code = $1`, [
      String(code ?? '').toUpperCase().trim(),
    ]);
    return row ? mapCoupon(row) : null;
  }

  public async findById(id: string): Promise<ICoupon | null> {
    const couponId = toBigIntParam(id);
    if (!couponId) return null;

    const row = await queryOne<CouponRow>(`${SELECT} WHERE id = $1`, [couponId]);
    return row ? mapCoupon(row) : null;
  }

  public async create(data: Partial<ICoupon>): Promise<ICoupon> {
    const row = await queryOne<CouponRow>(
      `INSERT INTO coupons
         (code, discount_type, discount_value, min_order_amount, max_uses, expiry_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ${RETURNING}`,
      [
        String(data.code || '').toUpperCase().trim(),
        data.discountType || 'fixed',
        Number(data.discountValue || 0),
        Number(data.minOrderAmount || 0),
        // `usageLimit` is the alias the admin form posts.
        Number(data.maxUses ?? (data as any).usageLimit ?? 0),
        data.expiryDate ?? (data as any).validTo ?? new Date(),
        data.isActive !== false,
      ],
    );

    return mapCoupon(row!);
  }

  public async update(id: string, data: Partial<ICoupon>): Promise<ICoupon | null> {
    const couponId = toBigIntParam(id);
    if (!couponId) return null;

    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
      const value = (data as Record<string, unknown>)[field];
      if (value === undefined) continue;

      values.push(field === 'code' ? String(value).toUpperCase().trim() : value);
      assignments.push(`${column} = $${values.length}`);
    }

    if (!assignments.length) return this.findById(id);

    values.push(couponId);
    const row = await queryOne<CouponRow>(
      `UPDATE coupons SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       ${RETURNING}`,
      values,
    );

    return row ? mapCoupon(row) : null;
  }

  public async delete(id: string): Promise<boolean> {
    const couponId = toBigIntParam(id);
    if (!couponId) return false;

    const result = await query('DELETE FROM coupons WHERE id = $1', [couponId]);
    return (result.rowCount ?? 0) > 0;
  }

  /** Atomic increment — two concurrent redemptions cannot both read the same count. */
  public async incrementUsedCount(id: string): Promise<void> {
    const couponId = toBigIntParam(id);
    if (!couponId) return;

    await query(
      'UPDATE coupons SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1',
      [couponId],
    );
  }
}
