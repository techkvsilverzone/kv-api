import { IPincodeRate } from '../domain/commerce';
import { query, queryOne, queryRows } from '../infrastructure/postgres/pool';
import { toDate, toNum } from '../infrastructure/postgres/mapping';

export { IPincodeRate };

interface PincodeRateRow {
  id: string;
  pincode: string;
  label: string;
  rate: number;
  created_at: Date | null;
  updated_at: Date | null;
}

const mapRate = (row: PincodeRateRow): IPincodeRate => ({
  _id: String(row.id),
  pincode: row.pincode,
  label: row.label,
  rate: toNum(row.rate),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

const SELECT = 'SELECT id, pincode, label, rate, created_at, updated_at FROM pincode_rates';

/**
 * Standalone shipping-rate table. Checkout delivery has moved to the
 * delivery-config zones, but the `/shipping/pincode-rates` endpoints still read
 * and write this, so the repository stays (spec §22).
 */
export class PincodeRateRepository {
  public async findAll(): Promise<IPincodeRate[]> {
    const rows = await queryRows<PincodeRateRow>(`${SELECT} ORDER BY pincode ASC`);
    return rows.map(mapRate);
  }

  public async findByPincode(pincode: string): Promise<IPincodeRate | null> {
    const row = await queryOne<PincodeRateRow>(`${SELECT} WHERE pincode = $1`, [
      String(pincode ?? '').trim(),
    ]);
    return row ? mapRate(row) : null;
  }

  public async create(data: {
    pincode: string;
    label: string;
    rate: number;
  }): Promise<IPincodeRate> {
    const row = await queryOne<PincodeRateRow>(
      `INSERT INTO pincode_rates (pincode, label, rate)
       VALUES ($1, $2, $3)
       ON CONFLICT (pincode) DO UPDATE SET
         label = EXCLUDED.label,
         rate  = EXCLUDED.rate,
         updated_at = NOW()
       RETURNING id, pincode, label, rate, created_at, updated_at`,
      [data.pincode.trim(), data.label.trim(), Number(data.rate)],
    );

    return mapRate(row!);
  }

  public async deleteByPincode(pincode: string): Promise<boolean> {
    const result = await query('DELETE FROM pincode_rates WHERE pincode = $1', [
      String(pincode ?? '').trim(),
    ]);
    return (result.rowCount ?? 0) > 0;
  }
}
