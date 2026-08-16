import { connectPostgres, disconnectPostgres, query } from '../infrastructure/postgres/pool';
import Logger from './logger';

/**
 * One-time reconciliation: create an `inventory` row for every product that
 * does not have one yet, seeded from the product's listed `quantity`.
 * Idempotent — existing inventory rows are left untouched.
 *
 * `Product.quantity` remains the seed value only; `inventory.current_stock` is
 * the authoritative figure once a row exists (spec §25).
 */
export async function seedInventoryFromProducts(): Promise<{ created: number; skipped: number }> {
  const total = await query<{ count: number }>('SELECT count(*)::int AS count FROM products');

  // A single set-based insert: `ON CONFLICT DO NOTHING` is exactly the
  // "never clobber an existing row" rule, enforced by the unique index on
  // product_id rather than by a read-then-write loop.
  const inserted = await query(
    `INSERT INTO inventory (product_id, current_stock)
     SELECT p.id, GREATEST(0, floor(COALESCE(p.quantity, 0))::int)
     FROM products p
     ON CONFLICT (product_id) DO NOTHING`,
  );

  const created = inserted.rowCount ?? 0;
  return { created, skipped: (total.rows[0]?.count ?? 0) - created };
}

// Allow running directly: `npm run seed:inventory`
if (require.main === module) {
  (async () => {
    try {
      await connectPostgres();
      const result = await seedInventoryFromProducts();
      Logger.info(`Inventory seed complete — created ${result.created}, skipped ${result.skipped}`);
    } catch (error) {
      Logger.error(`Inventory seed failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      await disconnectPostgres();
    }
  })();
}
