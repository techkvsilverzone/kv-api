import { IReturn, IReturnItem, ReturnFaultType } from '../domain/returns';
import { queryOne, queryRows, withTransaction } from '../infrastructure/postgres/pool';
import { toBigIntParam, toDate, toNum } from '../infrastructure/postgres/mapping';

export { IReturn };

/**
 * The customer quotes this in their WhatsApp video caption. It is derived from
 * the return's own id, so it is unique without a lookup, and stays inside the
 * `RET-[A-Z0-9]{6}` shape `return.service` matches on.
 */
const videoReferenceCode = (id: string): string => `RET-${String(id).padStart(6, '0').slice(-6)}`;

interface ReturnRow {
  id: string;
  order_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  reason: string | null;
  description: string | null;
  status: string;
  refund_amount: number;
  fault_type: string;
  video_status: string;
  video_reference_code: string | null;
  video_file_path: string | null;
  video_mime_type: string | null;
  video_received_at: Date | null;
  video_sender_phone: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  items: unknown;
  order: unknown;
}

const ITEMS_JSON = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'orderItemId', ri.order_item_id::text,
          'productName', ri.product_name,
          'quantity', ri.quantity,
          'reason', ri.reason
        )
        ORDER BY ri.id
      )
      FROM return_items ri
      WHERE ri.return_id = r.id
    ),
    '[]'::json
  ) AS items`;

/**
 * The order, as `populate('orderId')` returned it. Only the fields consumers
 * actually read are projected — `findAwaitingVideoByPhone` needs the shipping
 * phone, and the admin returns tab shows the invoice and totals.
 */
const ORDER_JSON = `
  CASE WHEN o.id IS NULL THEN NULL ELSE json_build_object(
    '_id', o.id::text,
    'invoiceNumber', o.invoice_number,
    'status', o.status,
    'totalAmount', o.total_amount::float8,
    'grandTotal', o.grand_total::float8,
    'deliveredAt', o.delivered_at,
    'createdAt', o.created_at,
    'shippingAddress', json_build_object(
      'name', o.shipping_name,
      'phone', o.shipping_phone,
      'line1', o.shipping_line1,
      'line2', o.shipping_line2,
      'city', o.shipping_city,
      'state', o.shipping_state,
      'pincode', o.shipping_pincode,
      'country', o.shipping_country
    )
  ) END AS "order"`;

const RETURN_COLUMNS = `
  r.id, r.order_id, r.user_id, r.reason, r.description, r.status, r.refund_amount,
  r.fault_type, r.video_status, r.video_reference_code, r.video_file_path,
  r.video_mime_type, r.video_received_at, r.video_sender_phone,
  r.created_at, r.updated_at`;

const RETURN_SELECT = `
  SELECT ${RETURN_COLUMNS}, NULL::text AS user_name, NULL::text AS user_email,
         ${ITEMS_JSON}, NULL::json AS "order"
  FROM returns r`;

const RETURN_SELECT_JOINED = `
  SELECT ${RETURN_COLUMNS}, u.name AS user_name, u.email AS user_email,
         ${ITEMS_JSON}, ${ORDER_JSON}
  FROM returns r
  LEFT JOIN users u ON u.id = r.user_id
  LEFT JOIN orders o ON o.id = r.order_id`;

/** Order joined but customer not — what `findAwaitingVideoByPhone` needs. */
const RETURN_SELECT_WITH_ORDER = `
  SELECT ${RETURN_COLUMNS}, NULL::text AS user_name, NULL::text AS user_email,
         ${ITEMS_JSON}, ${ORDER_JSON}
  FROM returns r
  LEFT JOIN orders o ON o.id = r.order_id`;

const mapReturn = (row: ReturnRow): IReturn => ({
  _id: String(row.id),
  orderId: (row.order as IReturn['orderId']) ?? String(row.order_id),
  userId:
    row.user_name !== null || row.user_email !== null
      ? { _id: String(row.user_id), name: row.user_name ?? '', email: row.user_email ?? '' }
      : String(row.user_id),
  reason: row.reason ?? '',
  description: row.description,
  status: row.status as IReturn['status'],
  refundAmount: toNum(row.refund_amount),
  items: Array.isArray(row.items)
    ? (row.items as Record<string, any>[]).map(
        (item): IReturnItem => ({
          orderItemId: item.orderItemId === null ? null : String(item.orderItemId),
          productName: String(item.productName ?? ''),
          quantity: toNum(item.quantity),
          reason: item.reason ?? null,
        }),
      )
    : [],
  faultType: row.fault_type as ReturnFaultType,
  videoStatus: row.video_status as IReturn['videoStatus'],
  videoReferenceCode: row.video_reference_code,
  videoFilePath: row.video_file_path,
  videoMimeType: row.video_mime_type,
  videoReceivedAt: toDate(row.video_received_at),
  videoSenderPhone: row.video_sender_phone,
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

export class ReturnRepository {
  public async create(data: any): Promise<IReturn> {
    const orderId = toBigIntParam(data.orderId);
    const userId = toBigIntParam(data.userId);
    if (!orderId) throw new Error(`Invalid order id: ${data.orderId}`);
    if (!userId) throw new Error(`Invalid user id: ${data.userId}`);

    const faultType: ReturnFaultType =
      data.faultType === 'customer_preference' ? 'customer_preference' : 'kv_fault';

    const items = (data.items || []).map((item: any) => {
      const rawId = item?.product?._id ?? item?.product?.id ?? item?.productId ?? item?.product;
      return {
        orderItemId: toBigIntParam(rawId),
        productName: String(item?.name || item?.productName || ''),
        quantity: Number(item?.quantity || 1),
        reason: item?.reason || null,
      };
    });

    const returnId = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO returns
           (order_id, user_id, reason, description, refund_amount, fault_type, video_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          orderId,
          userId,
          String(data.reason || ''),
          data.description || null,
          Number(data.refundAmount || 0),
          faultType,
          faultType === 'kv_fault' ? 'awaiting' : 'not_required',
        ],
      );

      const id = String(inserted.rows[0].id);

      // The reference code derives from the id, so it can only be assigned
      // once the row exists.
      if (faultType === 'kv_fault') {
        await client.query('UPDATE returns SET video_reference_code = $1 WHERE id = $2', [
          videoReferenceCode(id),
          id,
        ]);
      }

      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO return_items (return_id, order_item_id, product_name, quantity, reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, item.orderItemId, item.productName, item.quantity, item.reason],
        );
      }

      return id;
    });

    const created = await queryOne<ReturnRow>(`${RETURN_SELECT} WHERE r.id = $1`, [returnId]);
    if (!created) throw new Error('Return insert succeeded but the row could not be read back.');
    return mapReturn(created);
  }

  public async findByUserId(userId: string): Promise<IReturn[]> {
    const ownerId = toBigIntParam(userId);
    if (!ownerId) return [];

    const rows = await queryRows<ReturnRow>(
      `${RETURN_SELECT} WHERE r.user_id = $1 ORDER BY r.created_at DESC, r.id DESC`,
      [ownerId],
    );
    return rows.map(mapReturn);
  }

  public async findAll(): Promise<IReturn[]> {
    const rows = await queryRows<ReturnRow>(
      `${RETURN_SELECT_JOINED} ORDER BY r.created_at DESC, r.id DESC`,
    );
    return rows.map(mapReturn);
  }

  public async findById(id: string): Promise<IReturn | null> {
    const returnId = toBigIntParam(id);
    if (!returnId) return null;

    const row = await queryOne<ReturnRow>(`${RETURN_SELECT_JOINED} WHERE r.id = $1`, [returnId]);
    return row ? mapReturn(row) : null;
  }

  public async findByVideoReferenceCode(code: string): Promise<IReturn | null> {
    const row = await queryOne<ReturnRow>(`${RETURN_SELECT} WHERE r.video_reference_code = $1`, [
      String(code ?? '').trim().toUpperCase(),
    ]);
    return row ? mapReturn(row) : null;
  }

  /**
   * Returns still awaiting a video whose ORDER's shipping-address phone matches
   * the given WhatsApp sender number — the fallback match when no/garbled
   * reference code is in the caption. Matches on the last 10 digits only, so
   * formatting (+91, spaces, leading 0) doesn't cause a false miss.
   *
   * The digit-stripping now happens in SQL (`regexp_replace` + `right`), so the
   * database filters instead of every awaiting return being loaded and filtered
   * in Node.
   */
  public async findAwaitingVideoByPhone(phone: string): Promise<IReturn[]> {
    const normalized = phone.replace(/\D/g, '').slice(-10);
    if (!normalized) return [];

    const rows = await queryRows<ReturnRow>(
      `${RETURN_SELECT_WITH_ORDER}
       WHERE r.video_status = 'awaiting'
         AND o.shipping_phone IS NOT NULL
         AND right(regexp_replace(o.shipping_phone, '\\D', '', 'g'), 10) = $1
       ORDER BY r.created_at DESC, r.id DESC`,
      [normalized],
    );
    return rows.map(mapReturn);
  }

  public async attachVideo(
    id: string,
    data: { filePath: string; mimeType: string; senderPhone: string },
  ): Promise<IReturn | null> {
    const returnId = toBigIntParam(id);
    if (!returnId) return null;

    const updated = await queryOne<{ id: string }>(
      `UPDATE returns
       SET video_status = 'received',
           video_file_path = $2,
           video_mime_type = $3,
           video_sender_phone = $4,
           video_received_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [returnId, data.filePath, data.mimeType, data.senderPhone],
    );

    if (!updated) return null;

    const row = await queryOne<ReturnRow>(`${RETURN_SELECT} WHERE r.id = $1`, [returnId]);
    return row ? mapReturn(row) : null;
  }

  public async updateStatus(
    id: string,
    status: string,
    refundAmount: number,
  ): Promise<IReturn | null> {
    const returnId = toBigIntParam(id);
    if (!returnId) return null;

    const updated = await queryOne<{ id: string }>(
      `UPDATE returns
       SET status = $2, refund_amount = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [returnId, status, Number(refundAmount || 0)],
    );

    if (!updated) return null;

    // Re-read with the customer joined, matching the previous `populate`.
    const row = await queryOne<ReturnRow>(
      `${RETURN_SELECT_JOINED} WHERE r.id = $1`,
      [returnId],
    );
    return row ? mapReturn(row) : null;
  }
}
