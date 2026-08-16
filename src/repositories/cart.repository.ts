import { ICart, ICartItem } from '../domain/commerce';
import { queryOne, withTransaction } from '../infrastructure/postgres/pool';
import { toBigIntParam, toDate, toNum } from '../infrastructure/postgres/mapping';
import { productJson } from './sql/productJson';

export { ICart, ICartItem };

interface CartRow {
  id: string;
  user_id: string;
  created_at: Date | null;
  updated_at: Date | null;
  items: unknown;
}

/**
 * Items carry the whole product under `productId`, reproducing what
 * `populate('items.productId')` returned — cart consumers read
 * `item.productId._id`, so flattening it would break them.
 */
const CART_SELECT = `
  SELECT
    c.id, c.user_id, c.created_at, c.updated_at,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            '_id', ci.id::text,
            'productId', ${productJson('pr')},
            'productGroupCode', ci.product_group_code,
            'productName', ci.product_name,
            'quantity', ci.quantity,
            'weight', ci.weight::float8,
            'unitPrice', ci.unit_price::float8
          )
          ORDER BY ci.id
        )
        FROM cart_items ci
        JOIN products pr ON pr.id = ci.product_id
        WHERE ci.cart_id = c.id
      ),
      '[]'::json
    ) AS items
  FROM carts c`;

const mapCart = (row: CartRow): ICart => ({
  _id: String(row.id),
  userId: String(row.user_id),
  items: Array.isArray(row.items)
    ? (row.items as Record<string, any>[]).map(
        (item): ICartItem => ({
          _id: String(item._id),
          productId: item.productId,
          productGroupCode: String(item.productGroupCode ?? ''),
          productName: String(item.productName ?? ''),
          quantity: toNum(item.quantity),
          weight: toNum(item.weight),
          unitPrice: toNum(item.unitPrice),
        }),
      )
    : [],
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

export class CartRepository {
  public async findByUserId(userId: string): Promise<ICart | null> {
    const ownerId = toBigIntParam(userId);
    if (!ownerId) return null;

    const row = await queryOne<CartRow>(`${CART_SELECT} WHERE c.user_id = $1`, [ownerId]);
    return row ? mapCart(row) : null;
  }

  /**
   * Replace the cart's contents with `items`.
   *
   * Each incoming item is re-read from `products` so name, weight and price are
   * taken from the catalogue rather than trusted from the client — the same
   * guarantee the Mongo implementation gave. Unknown products and non-positive
   * quantities are silently dropped, as before.
   */
  public async update(userId: string, items: any[]): Promise<ICart | null> {
    const ownerId = toBigIntParam(userId);
    if (!ownerId) return null;

    await withTransaction(async (client) => {
      const cart = await client.query<{ id: string }>(
        `INSERT INTO carts (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [ownerId],
      );

      const cartId = String(cart.rows[0].id);

      await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

      for (const item of items) {
        const rawId = item?.product?._id ?? item?.product?.id ?? item?.productId ?? item?.product;
        const productId = toBigIntParam(rawId);
        if (!productId) continue;

        const quantity = Number(item?.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;

        // eslint-disable-next-line no-await-in-loop
        const product = await client.query<{
          id: string;
          product_group_code: string;
          name: string;
          weight: number;
          price: number;
        }>('SELECT id, product_group_code, name, weight, price FROM products WHERE id = $1', [
          productId,
        ]);

        if (!product.rowCount) continue;
        const row = product.rows[0];

        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO cart_items
             (cart_id, product_id, product_group_code, product_name, quantity, weight, unit_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            cartId,
            row.id,
            row.product_group_code,
            row.name,
            quantity,
            toNum(row.weight),
            toNum(row.price),
          ],
        );
      }
    });

    return this.findByUserId(userId);
  }

  public async removeItem(userId: string, productId: string): Promise<ICart | null> {
    const ownerId = toBigIntParam(userId);
    const targetId = toBigIntParam(productId);
    if (!ownerId || !targetId) return this.findByUserId(userId);

    await withTransaction(async (client) => {
      await client.query(
        `DELETE FROM cart_items
         WHERE product_id = $1
           AND cart_id IN (SELECT id FROM carts WHERE user_id = $2)`,
        [targetId, ownerId],
      );
      await client.query('UPDATE carts SET updated_at = NOW() WHERE user_id = $1', [ownerId]);
    });

    return this.findByUserId(userId);
  }
}
