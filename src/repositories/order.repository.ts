import { PoolClient } from 'pg';
import { IOrder, IOrderItem, IShippingAddress } from '../domain/order';
import { queryOne, queryRows, withTransaction } from '../infrastructure/postgres/pool';
import { toBigIntParam, toBool, toDate, toNum } from '../infrastructure/postgres/mapping';

export { IOrder, IOrderItem, IShippingAddress };

interface OrderRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  invoice_number: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  coupon_code: string | null;
  coupon_discount: number;
  gift_wrap: boolean;
  gift_message: string | null;
  gift_wrap_fee: number;
  subtotal: number;
  tax_amount: number;
  total_with_tax: number;
  delivery_fee: number;
  grand_total: number;
  total_amount: number;
  tax: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  shipping_country: string;
  delivered_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
  items: unknown;
}

const ITEMS_JSON = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          '_id', oi.id::text,
          'productId', oi.product_id::text,
          'productGroupCode', oi.product_group_code,
          'productName', oi.product_name,
          'quantity', oi.quantity,
          'weight', oi.weight::float8,
          'unitPrice', oi.unit_price::float8,
          'totalPrice', oi.total_price::float8,
          'isGiftVoucher', oi.is_gift_voucher
        )
        ORDER BY oi.id
      )
      FROM order_items oi
      WHERE oi.order_id = o.id
    ),
    '[]'::json
  ) AS items`;

const ORDER_COLUMNS = `
  o.id, o.user_id, o.invoice_number, o.status, o.payment_method, o.payment_status,
  o.razorpay_order_id, o.razorpay_payment_id, o.coupon_code, o.coupon_discount,
  o.gift_wrap, o.gift_message, o.gift_wrap_fee, o.subtotal, o.tax_amount,
  o.total_with_tax, o.delivery_fee, o.grand_total, o.total_amount, o.tax,
  o.shipping_name, o.shipping_phone, o.shipping_line1, o.shipping_line2,
  o.shipping_city, o.shipping_state, o.shipping_pincode, o.shipping_country,
  o.delivered_at, o.created_at, o.updated_at`;

/** Without the customer join — used where `populate` was not applied. */
const ORDER_SELECT = `
  SELECT ${ORDER_COLUMNS}, NULL::text AS user_name, NULL::text AS user_email, ${ITEMS_JSON}
  FROM orders o`;

/** With the customer join — the SQL equivalent of `populate('userId', 'name email')`. */
const ORDER_SELECT_WITH_USER = `
  SELECT ${ORDER_COLUMNS}, u.name AS user_name, u.email AS user_email, ${ITEMS_JSON}
  FROM orders o
  LEFT JOIN users u ON u.id = o.user_id`;

const mapOrder = (row: OrderRow): IOrder => ({
  _id: String(row.id),
  // Mirrors populate: an object when the customer was joined, a bare id otherwise.
  userId:
    row.user_name !== null || row.user_email !== null
      ? { _id: String(row.user_id), name: row.user_name ?? '', email: row.user_email ?? '' }
      : String(row.user_id),
  invoiceNumber: row.invoice_number ?? '',
  status: row.status,
  paymentMethod: row.payment_method,
  paymentStatus: row.payment_status,
  razorpayOrderId: row.razorpay_order_id,
  razorpayPaymentId: row.razorpay_payment_id,
  couponCode: row.coupon_code,
  couponDiscount: toNum(row.coupon_discount),
  giftWrap: toBool(row.gift_wrap),
  giftMessage: row.gift_message,
  giftWrapFee: toNum(row.gift_wrap_fee),
  subtotal: toNum(row.subtotal),
  taxAmount: toNum(row.tax_amount),
  totalWithTax: toNum(row.total_with_tax),
  deliveryFee: toNum(row.delivery_fee),
  grandTotal: toNum(row.grand_total),
  totalAmount: toNum(row.total_amount),
  tax: toNum(row.tax),
  shippingAddress: {
    name: row.shipping_name,
    phone: row.shipping_phone,
    line1: row.shipping_line1,
    line2: row.shipping_line2,
    city: row.shipping_city,
    state: row.shipping_state,
    pincode: row.shipping_pincode,
    country: row.shipping_country,
  },
  items: Array.isArray(row.items)
    ? (row.items as Record<string, any>[]).map(
        (item): IOrderItem => ({
          _id: String(item._id),
          productId: item.productId === null ? null : String(item.productId),
          productGroupCode: String(item.productGroupCode ?? ''),
          productName: String(item.productName ?? ''),
          quantity: toNum(item.quantity),
          weight: toNum(item.weight),
          unitPrice: toNum(item.unitPrice),
          totalPrice: toNum(item.totalPrice),
          isGiftVoucher: Boolean(item.isGiftVoucher),
        }),
      )
    : [],
  deliveredAt: toDate(row.delivered_at),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

export class OrderRepository {
  /**
   * Sequential per-calendar-year tax invoice number, e.g. "INV-2026-000123".
   *
   * Derived from the highest sequence already issued this year rather than a
   * row count, so a deleted or cancelled order cannot cause a number to be
   * reused. The caller holds a transaction-scoped advisory lock keyed on the
   * year, which serialises concurrent allocations — a plain count-and-increment
   * would let two simultaneous checkouts pick the same number and collide on
   * the unique index.
   */
  private async generateInvoiceNumber(client: PoolClient): Promise<string> {
    const year = new Date().getFullYear();

    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [1, year]);

    const result = await client.query<{ next: number }>(
      `SELECT COALESCE(
                MAX(NULLIF(substring(invoice_number FROM '^INV-\\d{4}-(\\d+)$'), '')::int),
                0
              ) + 1 AS next
       FROM orders
       WHERE invoice_number LIKE $1`,
      [`INV-${year}-%`],
    );

    return `INV-${year}-${String(result.rows[0].next).padStart(6, '0')}`;
  }

  public async create(data: any): Promise<IOrder> {
    const shippingAddress = data.shippingAddress || {};
    const userId = toBigIntParam(data.user);
    if (!userId) throw new Error(`Invalid user id: ${data.user}`);

    const items = (data.items || []).map((item: any) => {
      const rawId = item?.product?._id ?? item?.product?.id ?? item?.productId ?? item?.product;
      const quantity = Number(item?.quantity || 1);
      const unitPrice = Number(item?.price || item?.unitPrice || 0);

      return {
        // A line with no resolvable catalogue product (a gift voucher, or a
        // product deleted since) stores NULL rather than a fabricated id.
        productId: toBigIntParam(rawId),
        productGroupCode: String(item?.productGroupCode || item?.productGroup || ''),
        productName: String(item?.name || item?.productName || ''),
        quantity,
        weight: Number(item?.weight || item?.weightGm || 0),
        unitPrice,
        totalPrice: unitPrice * quantity,
        isGiftVoucher: Boolean(item?.isGiftVoucher || false),
      };
    });

    // The order header, its line items and the invoice number are written as
    // one unit — a partial order would be unrecoverable financial state (spec §26).
    const orderId = await withTransaction(async (client) => {
      const invoiceNumber = await this.generateInvoiceNumber(client);

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO orders (
           user_id, invoice_number, status, payment_method, payment_status,
           razorpay_payment_id, coupon_code, coupon_discount, gift_wrap, gift_message,
           gift_wrap_fee, subtotal, tax_amount, total_with_tax, delivery_fee,
           grand_total, total_amount, tax,
           shipping_name, shipping_phone, shipping_line1, shipping_line2,
           shipping_city, shipping_state, shipping_pincode, shipping_country
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
                 $19,$20,$21,$22,$23,$24,$25,$26)
         RETURNING id`,
        [
          userId,
          invoiceNumber,
          data.status || 'Pending',
          String(data.paymentMethod || 'cod').toLowerCase(),
          data.razorpayPaymentId ? 'Paid' : 'Pending',
          data.razorpayPaymentId || null,
          data.couponCode || null,
          Number(data.couponDiscount || 0),
          Boolean(data.giftWrap || false),
          data.giftMessage || null,
          Number(data.giftWrapFee || 0),
          Number(data.subtotal || 0),
          Number(data.taxAmount || 0),
          Number(data.totalWithTax || 0),
          Number(data.deliveryFee || 0),
          Number(data.grandTotal || 0),
          Number(data.totalAmount || 0),
          Number(data.tax || 0),
          String(
            shippingAddress.name ||
              `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim(),
          ),
          String(shippingAddress.phone || ''),
          String(shippingAddress.line1 || shippingAddress.address || ''),
          shippingAddress.line2 || null,
          String(shippingAddress.city || ''),
          String(shippingAddress.state || ''),
          String(shippingAddress.pincode || ''),
          String(shippingAddress.country || 'India'),
        ],
      );

      const id = String(inserted.rows[0].id);

      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO order_items
             (order_id, product_id, product_group_code, product_name, quantity,
              weight, unit_price, total_price, is_gift_voucher)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            id,
            item.productId,
            item.productGroupCode,
            item.productName,
            item.quantity,
            item.weight,
            item.unitPrice,
            item.totalPrice,
            item.isGiftVoucher,
          ],
        );
      }

      return id;
    });

    const created = await this.findByIdRaw(orderId);
    if (!created) throw new Error('Order insert succeeded but the row could not be read back.');
    return created;
  }

  public async findByUserId(userId: string): Promise<IOrder[]> {
    const ownerId = toBigIntParam(userId);
    if (!ownerId) return [];

    const rows = await queryRows<OrderRow>(
      `${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC, o.id DESC`,
      [ownerId],
    );
    return rows.map(mapOrder);
  }

  public async findAll(): Promise<IOrder[]> {
    const rows = await queryRows<OrderRow>(
      `${ORDER_SELECT_WITH_USER} ORDER BY o.created_at DESC, o.id DESC`,
    );
    return rows.map(mapOrder);
  }

  public async findById(id: string): Promise<IOrder | null> {
    const orderId = toBigIntParam(id);
    if (!orderId) return null;

    const row = await queryOne<OrderRow>(`${ORDER_SELECT_WITH_USER} WHERE o.id = $1`, [orderId]);
    return row ? mapOrder(row) : null;
  }

  /** Read back without the customer join — used immediately after `create`. */
  private async findByIdRaw(id: string): Promise<IOrder | null> {
    const row = await queryOne<OrderRow>(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
    return row ? mapOrder(row) : null;
  }

  public async updateStatus(id: string, status: string): Promise<IOrder | null> {
    const orderId = toBigIntParam(id);
    if (!orderId) return null;

    // Stamp deliveredAt the FIRST time an order reaches 'Delivered' — this anchors
    // the return claim window, so it must never be overwritten by a later re-save.
    // COALESCE does that in a single statement, closing the read-then-write race
    // the previous two-step version had.
    const result = await queryOne<{ id: string }>(
      `UPDATE orders
       SET status = $2,
           delivered_at = CASE
             WHEN $2 = 'Delivered' THEN COALESCE(delivered_at, NOW())
             ELSE delivered_at
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [orderId, status],
    );

    if (!result) return null;
    return this.findById(id);
  }

  public async getStats(): Promise<{ totalRevenue: number; totalOrders: number }> {
    const row = await queryOne<{ total_revenue: number | null; total_orders: number }>(
      `SELECT COALESCE(SUM(total_amount), 0)::float8 AS total_revenue,
              count(*)::int AS total_orders
       FROM orders`,
    );

    return {
      totalRevenue: toNum(row?.total_revenue),
      totalOrders: toNum(row?.total_orders),
    };
  }
}
