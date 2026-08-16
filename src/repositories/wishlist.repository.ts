import { query, queryRows } from '../infrastructure/postgres/pool';
import { toBigIntParam } from '../infrastructure/postgres/mapping';
import { productJson } from './sql/productJson';

export class WishlistRepository {
  /**
   * The wishlist as the client consumes it: `{ items: [{ product }] }`.
   *
   * A user with no wishlist row gets an empty list rather than null, which is
   * what the Mongo implementation returned and what the storefront expects.
   */
  public async findByUserId(userId: string): Promise<any> {
    const ownerId = toBigIntParam(userId);
    if (!ownerId) return { items: [] };

    const rows = await queryRows<{ product: unknown }>(
      `SELECT ${productJson('pr')} AS product
       FROM wishlist_items wi
       JOIN wishlists w ON w.id = wi.wishlist_id
       JOIN products pr ON pr.id = wi.product_id
       WHERE w.user_id = $1
       ORDER BY wi.id`,
      [ownerId],
    );

    return { items: rows.map((row) => ({ product: row.product })) };
  }

  public async addItem(userId: string, productId: string): Promise<any> {
    const ownerId = toBigIntParam(userId);
    const targetId = toBigIntParam(productId);
    if (!ownerId || !targetId) return this.findByUserId(userId);

    // Two statements rather than a transaction: the second is idempotent via
    // the (wishlist_id, product_id) unique constraint, so a retry is harmless.
    const wishlist = await query<{ id: string }>(
      `INSERT INTO wishlists (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [ownerId],
    );

    await query(
      `INSERT INTO wishlist_items (wishlist_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (wishlist_id, product_id) DO NOTHING`,
      [String(wishlist.rows[0].id), targetId],
    );

    return this.findByUserId(userId);
  }

  public async removeItem(userId: string, productId: string): Promise<any> {
    const ownerId = toBigIntParam(userId);
    const targetId = toBigIntParam(productId);
    if (!ownerId || !targetId) return this.findByUserId(userId);

    await query(
      `DELETE FROM wishlist_items
       WHERE product_id = $1
         AND wishlist_id IN (SELECT id FROM wishlists WHERE user_id = $2)`,
      [targetId, ownerId],
    );

    return this.findByUserId(userId);
  }
}
