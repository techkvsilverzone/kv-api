# In-store / stall sales (offline orders)

Admin and staff bill walk-in customers from the admin panel (**In-store Sale** tab). An offline sale is an
ordinary row in `orders` + `order_items`, so it appears in the Orders list, revenue stats and invoice numbering
(`INV-YYYY-NNNNNN`) exactly like an online order. Stock is reduced through the same `StockService.reserveForOrder`
path as online checkout, which also writes an `inventory_transactions` "OUT" row (reason `Offline sale — <location>`).

- `channel` — `'ONLINE'` (default, every existing row) or `'OFFLINE'`.
- `user_id` — now nullable. An offline sale is linked to a customer account only when the mobile number entered
  matches one (so it also shows in that customer's "My Orders"); a walk-in sale with no account leaves it NULL.
- `sold_by` — the admin/staff user who rang up the sale.
- `sale_location` — free text such as "Anna Nagar stall" or "Showroom", for per-stall reporting.

Offline sales are created already `Delivered` and `Paid` (`delivered_at` set), with no delivery fee.

## DDL (apply once, idempotent)

```sql
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'ONLINE';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sold_by BIGINT REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_location VARCHAR(200);
CREATE INDEX IF NOT EXISTS ix_orders_channel ON orders (channel);
```

## Report queries

```sql
-- Offline sales per location and day
SELECT created_at::date AS day, COALESCE(sale_location, '—') AS location, count(*) AS bills, SUM(total_amount) AS revenue
FROM orders WHERE channel = 'OFFLINE'
GROUP BY 1, 2 ORDER BY 1 DESC, 2;

-- Units sold offline per product
SELECT oi.product_name, SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE o.channel = 'OFFLINE'
GROUP BY 1 ORDER BY units DESC;
```
