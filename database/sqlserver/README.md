# SQL Server Database Scripts

This folder contains SQL Server scripts for storing KV Silver Zone product catalog data using an image-based inventory model.

## Data Model

- `kv.CatalogConfig`: single-row table for catalog-level settings (`currency`, `inventory_type`).
- `kv.ProductGroup`: one row per business product (`product_group`) containing shared attributes.
- `kv.ProductImage`: one row per image/variant (`image_id`) linked to `ProductGroup`, storing `ImageBase64` content.
- `kv.[User]`: auth and profile data (`/auth`, `/users`, admin user listing).
- `kv.Cart`, `kv.CartItem`: user cart headers and line items (`/cart`).
- `kv.[Order]`, `kv.OrderShippingAddress`, `kv.OrderItem`: order checkout and admin order management (`/orders`, `/admin/orders`, `/admin/stats`).
- `kv.SavingsEnrollment`: savings schemes (`/savings/enroll`, `/savings/my-schemes`).
- `kv.ContactEnquiry`: optional persistence for `/contact` enquiries.
- `kv.vw_ProductCatalog`: flattened read view for API queries.
- `kv.vw_AdminStats`: consolidated dashboard totals.
- `kv.usp_GetCatalogByGroup`: query procedure to fetch one product group and all image variants.

This structure avoids duplicating product attributes across each image row while preserving your incoming payload format.

## Scripts

1. `001_create_schema.sql`
   - Creates schema `kv`, core tables, constraints, index, view, and stored procedure.

2. `002_seed_products.sql`
   - Seeds catalog config (`INR`, `image_based`), all product groups, and 26 image records.
   - Script is idempotent (safe to re-run): updates existing rows and inserts missing rows.

3. `003_create_domain_schema.sql`
   - Creates users, cart, orders, savings, contact tables, constraints, indexes, and admin stats view.

4. `004_seed_domain_data.sql`
   - Seeds auth-ready users (admin + sample user with bcrypt hashes), and sample cart/order/savings/contact rows.
   - Script is idempotent for key records and safe to re-run.

5. `005_migrate_productimage_base64.sql`
   - For existing databases: adds `ImageBase64` to `kv.ProductImage`, backfills from old `ImageUrl` data, and refreshes catalog view/procedure.

## Run Order

Execute scripts in this exact order:

1. `001_create_schema.sql`
2. `002_seed_products.sql`
3. `003_create_domain_schema.sql`
4. `004_seed_domain_data.sql`
5. `005_migrate_productimage_base64.sql` (run if your DB was created before Base64 migration)

## Endpoint to Table Mapping

- `POST /auth/signup`, `POST /auth/login`, `GET/PUT /users/me`, `GET /admin/users`:
   - `kv.[User]`
- `GET /products`, `GET /products/:id`, admin product CRUD:
   - `kv.ProductGroup`, `kv.ProductImage`, `kv.CatalogConfig`, `kv.vw_ProductCatalog`
- `GET /cart`, `POST /cart/items`, `DELETE /cart/items/:id`:
   - `kv.Cart`, `kv.CartItem`
- `POST /orders`, `GET /orders/me`, `GET /admin/orders`, `PUT /admin/orders/:id/status`:
   - `kv.[Order]`, `kv.OrderShippingAddress`, `kv.OrderItem`
- `POST /savings/enroll`, `GET /savings/my-schemes`:
   - `kv.SavingsEnrollment`
- `POST /contact`:
   - `kv.ContactEnquiry`
- `GET /admin/stats`:
   - `kv.vw_AdminStats` (or direct aggregate queries)

## Quick Validation Queries

```sql
SELECT * FROM kv.CatalogConfig;
SELECT * FROM kv.ProductGroup ORDER BY ProductGroupCode;
SELECT * FROM kv.ProductImage ORDER BY ImageId;
SELECT * FROM kv.vw_ProductCatalog ORDER BY ProductGroupCode, SortOrder;
SELECT * FROM kv.[User] ORDER BY CreatedAt DESC;
SELECT * FROM kv.vw_AdminStats;

EXEC kv.usp_GetCatalogByGroup @ProductGroupCode = 'BOWL-01';
```

## Notes for API Integration

- Keep your API response shape by reading from `kv.vw_ProductCatalog` and grouping by `ProductGroupCode`.
- `WeightGm` is nullable because some provided items do not include weight.
- Product image payloads can now be stored directly as Base64 in `kv.ProductImage.ImageBase64`.
- Seeded credentials:
   - Admin: `admin@kvsilverzone.com` / `Admin@123`
   - User: `user1@kvsilverzone.com` / `User@123`