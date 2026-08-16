import {
  IInventory,
  IInventoryTransaction,
  TransactionType,
} from '../domain/inventory';
import { query, queryOne, queryRows } from '../infrastructure/postgres/pool';
import { toBigIntParam, toBool, toDate, toNum } from '../infrastructure/postgres/mapping';

export { TransactionType };

export interface CreateTransactionData {
  type: TransactionType;
  productId: string;
  quantity: number;
  reason: string;
  performedBy: string;
}

export interface TransactionFilters {
  productId?: string;
  type?: TransactionType;
  limit?: number;
}

interface InventoryRow {
  id: string;
  product_id: string;
  current_stock: number;
  stock_threshold: number;
  created_at: Date | null;
  updated_at: Date | null;
  product_name?: string | null;
  product_is_active?: boolean | null;
}

const mapInventory = (row: InventoryRow, withProduct = false): IInventory => ({
  _id: String(row.id),
  productId: withProduct
    ? {
        _id: String(row.product_id),
        name: row.product_name ?? '',
        isActive: toBool(row.product_is_active),
      }
    : String(row.product_id),
  currentStock: toNum(row.current_stock),
  stockThreshold: toNum(row.stock_threshold, 5),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

export class InventoryRepository {
  // ── Inventory stock document ──────────────────────────────────────────

  public async findByProductId(productId: string): Promise<IInventory | null> {
    const id = toBigIntParam(productId);
    if (!id) return null;

    const row = await queryOne<InventoryRow>(
      `SELECT id, product_id, current_stock, stock_threshold, created_at, updated_at
       FROM inventory WHERE product_id = $1`,
      [id],
    );
    return row ? mapInventory(row) : null;
  }

  public async upsertStock(
    productId: string,
    currentStock: number,
    stockThreshold?: number,
  ): Promise<IInventory> {
    const id = toBigIntParam(productId);
    if (!id) throw new Error(`Invalid product id: ${productId}`);

    // A null $3 means "threshold not specified": it falls back to the column
    // default on insert and leaves the stored value untouched on update.
    const row = await queryOne<InventoryRow>(
      `INSERT INTO inventory (product_id, current_stock, stock_threshold)
       VALUES ($1, $2, COALESCE($3, 5))
       ON CONFLICT (product_id) DO UPDATE SET
         current_stock   = EXCLUDED.current_stock,
         stock_threshold = COALESCE($3, inventory.stock_threshold),
         updated_at      = NOW()
       RETURNING id, product_id, current_stock, stock_threshold, created_at, updated_at`,
      [id, currentStock, stockThreshold ?? null],
    );

    return mapInventory(row!);
  }

  /**
   * Create the stock document only if it does not exist yet (lazy seed from the
   * product's listed quantity). Never clobbers an existing currentStock.
   */
  public async ensureStock(
    productId: string,
    initialStock: number,
    stockThreshold?: number,
  ): Promise<IInventory> {
    const id = toBigIntParam(productId);
    if (!id) throw new Error(`Invalid product id: ${productId}`);

    // DO NOTHING would not return the existing row, so the conflict path is a
    // no-op UPDATE purely to make RETURNING fire either way.
    const row = await queryOne<InventoryRow>(
      `INSERT INTO inventory (product_id, current_stock, stock_threshold)
       VALUES ($1, $2, COALESCE($3, 5))
       ON CONFLICT (product_id) DO UPDATE SET product_id = inventory.product_id
       RETURNING id, product_id, current_stock, stock_threshold, created_at, updated_at`,
      [id, Math.max(0, Math.floor(initialStock) || 0), stockThreshold ?? null],
    );

    return mapInventory(row!);
  }

  public async findAllStock(): Promise<IInventory[]> {
    const rows = await queryRows<InventoryRow>(
      `SELECT
         i.id, i.product_id, i.current_stock, i.stock_threshold, i.created_at, i.updated_at,
         p.name AS product_name, p.is_active AS product_is_active
       FROM inventory i
       JOIN products p ON p.id = i.product_id
       ORDER BY i.id`,
    );
    return rows.map((row) => mapInventory(row, true));
  }

  /**
   * Atomically decrement stock only when at least `qty` is available.
   * Returns true on success, false if insufficient (no change).
   *
   * The `current_stock >= $2` predicate is evaluated by PostgreSQL while the
   * row is locked for update, so two concurrent checkouts cannot both pass the
   * check and oversell — the same guarantee Mongo's conditional filter gave.
   */
  public async decrementStockAtomic(productId: string, qty: number): Promise<boolean> {
    const id = toBigIntParam(productId);
    if (!id) return false;

    const result = await query(
      `UPDATE inventory
       SET current_stock = current_stock - $2, updated_at = NOW()
       WHERE product_id = $1 AND current_stock >= $2`,
      [id, qty],
    );

    return (result.rowCount ?? 0) > 0;
  }

  /** Restore stock (rollback of a partial reservation). */
  public async incrementStock(productId: string, qty: number): Promise<void> {
    const id = toBigIntParam(productId);
    if (!id) return;

    await query(
      `UPDATE inventory
       SET current_stock = current_stock + $2, updated_at = NOW()
       WHERE product_id = $1`,
      [id, qty],
    );
  }

  /** Map of productId -> currentStock for a set of products (for read enrichment). */
  public async getStockMap(productIds: string[]): Promise<Record<string, number>> {
    const ids = productIds.map(toBigIntParam).filter((id): id is string => id !== null);
    if (ids.length === 0) return {};

    const rows = await queryRows<{ product_id: string; current_stock: number }>(
      'SELECT product_id, current_stock FROM inventory WHERE product_id = ANY($1)',
      [ids],
    );

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[String(row.product_id)] = toNum(row.current_stock);
    }
    return map;
  }

  // ── Inventory transactions (audit log) ───────────────────────────────

  public async createTransaction(data: CreateTransactionData): Promise<IInventoryTransaction> {
    const productId = toBigIntParam(data.productId);
    const performedBy = toBigIntParam(data.performedBy);
    if (!productId) throw new Error(`Invalid product id: ${data.productId}`);
    if (!performedBy) throw new Error(`Invalid user id: ${data.performedBy}`);

    const row = await queryOne<{
      id: string;
      type: string;
      product_id: string;
      quantity: number;
      reason: string;
      performed_by: string;
      date: Date | null;
    }>(
      `INSERT INTO inventory_transactions (type, product_id, quantity, reason, performed_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, product_id, quantity, reason, performed_by, date`,
      [data.type, productId, data.quantity, data.reason, performedBy],
    );

    return {
      _id: String(row!.id),
      type: row!.type as TransactionType,
      productId: String(row!.product_id),
      quantity: toNum(row!.quantity),
      reason: row!.reason,
      performedBy: String(row!.performed_by),
      date: toDate(row!.date),
    };
  }

  public async findTransactions(filters: TransactionFilters = {}): Promise<any[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    const bind = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    const productId = filters.productId ? toBigIntParam(filters.productId) : null;
    if (productId) conditions.push(`t.product_id = ${bind(productId)}`);
    if (filters.type === 'IN' || filters.type === 'OUT') {
      conditions.push(`t.type = ${bind(filters.type)}`);
    }

    const limit = filters.limit ? Number(filters.limit) : 100;

    const rows = await queryRows<{
      id: string;
      type: string;
      product_id: string;
      product_name: string | null;
      quantity: number;
      reason: string;
      date: Date | null;
      performed_by: string;
    }>(
      `SELECT
         t.id, t.type, t.product_id, p.name AS product_name,
         t.quantity, t.reason, t.date, t.performed_by
       FROM inventory_transactions t
       LEFT JOIN products p ON p.id = t.product_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY t.date DESC, t.id DESC
       LIMIT ${bind(limit)}`,
      values,
    );

    // The JOIN replaces two `populate()` calls; the response shape is unchanged.
    return rows.map((row) => ({
      id: String(row.id),
      type: row.type,
      productId: String(row.product_id),
      productName: row.product_name ?? '',
      quantity: toNum(row.quantity),
      reason: row.reason,
      date: toDate(row.date),
      performedBy: String(row.performed_by),
    }));
  }

  /**
   * Count of movements since a cutoff — backs the admin inventory summary.
   * Replaces a `countDocuments` the service ran directly against the model.
   */
  public async countTransactionsSince(since: Date): Promise<number> {
    const row = await queryOne<{ count: number }>(
      'SELECT count(*)::int AS count FROM inventory_transactions WHERE date >= $1',
      [since],
    );
    return toNum(row?.count);
  }
}
