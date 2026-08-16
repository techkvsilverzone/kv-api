import { IGiftVoucher } from '../domain/commerce';
import { query, queryOne, queryRows } from '../infrastructure/postgres/pool';
import { persistImage } from '../infrastructure/storage/productImages';
import { toBigIntParam, toBool, toDate, toNum } from '../infrastructure/postgres/mapping';

export { IGiftVoucher };

interface GiftVoucherRow {
  id: string;
  label: string;
  amount: number;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date | null;
  updated_at: Date | null;
}

/**
 * Voucher artwork follows the same rule as product images: the database holds a
 * URL, never binary. `imageBase64` echoes that URL so the existing admin panel
 * and storefront keep working unchanged.
 */
const mapVoucher = (row: GiftVoucherRow): IGiftVoucher => ({
  _id: String(row.id),
  label: row.label,
  amount: toNum(row.amount),
  description: row.description,
  imageUrl: row.image_url,
  imageBase64: row.image_url,
  isActive: toBool(row.is_active, true),
  sortOrder: toNum(row.sort_order, 1),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

const SELECT = `
  SELECT id, label, amount, description, image_url, is_active, sort_order, created_at, updated_at
  FROM gift_vouchers`;

const RETURNING = `
  RETURNING id, label, amount, description, image_url, is_active, sort_order, created_at, updated_at`;

export class GiftVoucherRepository {
  public async findActive(): Promise<IGiftVoucher[]> {
    const rows = await queryRows<GiftVoucherRow>(
      `${SELECT} WHERE is_active = TRUE ORDER BY sort_order ASC, amount ASC`,
    );
    return rows.map(mapVoucher);
  }

  public async findAll(): Promise<IGiftVoucher[]> {
    const rows = await queryRows<GiftVoucherRow>(`${SELECT} ORDER BY sort_order ASC, amount ASC`);
    return rows.map(mapVoucher);
  }

  public async findById(id: string): Promise<IGiftVoucher | null> {
    const voucherId = toBigIntParam(id);
    if (!voucherId) return null;

    const row = await queryOne<GiftVoucherRow>(`${SELECT} WHERE id = $1`, [voucherId]);
    return row ? mapVoucher(row) : null;
  }

  public async create(data: Partial<IGiftVoucher>): Promise<IGiftVoucher> {
    const inserted = await queryOne<GiftVoucherRow>(
      `INSERT INTO gift_vouchers (label, amount, description, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ${RETURNING}`,
      [
        String(data.label || '').trim(),
        Number(data.amount || 0),
        data.description ?? null,
        data.isActive !== false,
        Number(data.sortOrder ?? 1),
      ],
    );

    // The artwork is written after the insert so the file can be filed under
    // the voucher's own id.
    const source = data.imageBase64 ?? data.imageUrl;
    if (typeof source === 'string' && source.trim()) {
      const url = await persistImage(`gift-vouchers/${inserted!.id}`, 0, source);
      if (url) {
        const updated = await queryOne<GiftVoucherRow>(
          `UPDATE gift_vouchers SET image_url = $1, updated_at = NOW() WHERE id = $2 ${RETURNING}`,
          [url, String(inserted!.id)],
        );
        return mapVoucher(updated!);
      }
    }

    return mapVoucher(inserted!);
  }

  public async update(id: string, data: Partial<IGiftVoucher>): Promise<IGiftVoucher | null> {
    const voucherId = toBigIntParam(id);
    if (!voucherId) return null;

    const assignments: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, value: unknown): void => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };

    if (data.label !== undefined) push('label', String(data.label).trim());
    if (data.amount !== undefined) push('amount', Number(data.amount));
    if (data.description !== undefined) push('description', data.description);
    if (data.isActive !== undefined) push('is_active', Boolean(data.isActive));
    if (data.sortOrder !== undefined) push('sort_order', Number(data.sortOrder));

    const source = data.imageBase64 ?? data.imageUrl;
    if (source !== undefined) {
      const value = typeof source === 'string' ? source.trim() : '';
      push('image_url', value ? await persistImage(`gift-vouchers/${voucherId}`, 0, value) : null);
    }

    if (!assignments.length) return this.findById(id);

    values.push(voucherId);
    const row = await queryOne<GiftVoucherRow>(
      `UPDATE gift_vouchers SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       ${RETURNING}`,
      values,
    );

    return row ? mapVoucher(row) : null;
  }

  public async delete(id: string): Promise<boolean> {
    const voucherId = toBigIntParam(id);
    if (!voucherId) return false;

    const result = await query('DELETE FROM gift_vouchers WHERE id = $1', [voucherId]);
    return (result.rowCount ?? 0) > 0;
  }
}
