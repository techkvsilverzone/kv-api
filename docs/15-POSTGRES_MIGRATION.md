# MongoDB → PostgreSQL Migration

Implements `MongoDB_to_PostgreSQL_API_Migration_Specification.docx`. The runtime
now reads and writes PostgreSQL 17 only; MongoDB survives solely inside
`src/migration/` as one-off tooling.

`Client → Express API → Controllers → Services → PostgreSQL Repositories → PostgreSQL 17`

## What changed, and what deliberately did not

Everything above the repository boundary was left alone. Services, controllers,
routes, pricing rules, savings rules, auth behaviour and API response shapes are
unchanged; only the inside of `src/repositories/*` was rewritten. The few service
edits that were unavoidable are listed under *Service-layer edits* below.

## Infrastructure

| File | Role |
| --- | --- |
| `src/infrastructure/postgres/pool.ts` | The only `pg.Pool` in the process. Exposes `query` / `queryOne` / `queryRows` / `withTransaction` / `pingPostgres` / `connectPostgres` / `disconnectPostgres`. |
| `src/infrastructure/postgres/mapping.ts` | Row→domain coercion shared by every repository (`toBigIntParam`, `toNum`, `toDate`, `dateOnlyToDate`, …). |
| `src/infrastructure/storage/productImages.ts` | Converts uploaded base64 to WebP on disk and returns the public URL. |
| `src/domain/*.ts` | Plain TypeScript interfaces replacing the Mongoose document types. |

**Type parsers** are installed once in `pool.ts`:

- `DATE` → left as `'YYYY-MM-DD'`. node-pg would otherwise build a `Date` at the
  *server's* local midnight, silently shifting the calendar day either side of UTC.
- `NUMERIC` → parsed to `number`, matching how the Mongo-era code already treated
  every money and weight value.
- `BIGINT` → left as a string, so ids stay safe past 2^53.

**Graceful shutdown**: `SIGTERM`/`SIGINT` close the HTTP listener first, then the
pool. **Health**: `GET /health` runs `SELECT 1` and answers `503 {status:'DOWN'}`
when the database is unreachable, so a load balancer can drain the instance. The
response contract (`status` + `timestamp`) is unchanged.

## Identity strategy

PostgreSQL BIGINT identities replace Mongo ObjectIds. Repositories return them as
**strings** under the key `_id` — the key was kept because every service,
response mapper and test already reads `user._id.toString()`, and the API has
always emitted `_id`. `legacy_mongo_id` is reconciliation-only and never drives
business logic (spec §7).

`toBigIntParam` guards every id entry point: a leftover 24-character ObjectId from
an old client or bookmarked URL yields a clean *not found* instead of a 500 from
PostgreSQL's `invalid input syntax for type bigint`.

## Nested shapes preserved over a relational schema

The storage is relational; the API shape is not. These are reassembled in SQL via
`json_agg`/`json_build_object` in a single round trip, replacing `populate()`:

| API shape | Tables |
| --- | --- |
| `user.addresses[]` | `user_addresses` |
| `product.variants[]`, `product.images[]` | `product_variants`, `product_images` |
| `cart.items[].productId` (whole product) | `cart_items` ⋈ `products` |
| `order.items[]`, `order.shippingAddress` | `order_items`, `orders.shipping_*` |
| `savings.payments[]`, `.cancellation`, `.maturityBenefits` | `savings_payments`, `savings_cancellations`, `savings_maturity_benefits` |
| `filterConfig.priceRanges[]` | `filter_price_ranges` |
| `schemePlan.monthlyAmounts[]`, `.hamper` | `scheme_plan_monthly_amounts`, `scheme_plans.gold_coin_purity`/… |

Where a query previously used `populate`, the joined entity is attached under the
same key it had before (`order.userId` becomes `{_id,name,email}`), so callers
that read `order.userId._id` keep working.

## Product images (spec §13, §36)

`product_images.image_url` holds a public path served by Nginx from
`IMAGE_STORAGE_ROOT`; **no base64 is stored or read back**. The admin panel still
uploads base64, and that request contract is preserved — the decode/resize/WebP
step now runs on the write path in `productImages.ts` instead of only in the
one-off image migration.

Reads expose the URL under **both** `imageUrl` (new, clearer) and `imageBase64`
(the key the storefront already reads). An `<img src>` accepts a URL exactly
where it accepted a data URI, so the frontend needed no change. Gift-voucher
artwork follows the same rule.

## Transactions and concurrency (spec §26)

`withTransaction` wraps everything that must be atomic. Beyond porting, three
read-then-write races were closed by moving the decision into SQL:

- **Invoice numbers** — derived from the highest sequence issued this year under a
  transaction-scoped advisory lock, instead of a row count. Two simultaneous
  checkouts can no longer pick the same number, and a deleted order can no longer
  cause one to be reused.
- **Passbook numbers** — minted under an advisory lock keyed on the scheme prefix,
  inside the same transaction as the installment that triggers minting.
- **`deliveredAt`** — stamped with `COALESCE(delivered_at, NOW())` in the same
  statement as the status change, so the return-claim window anchor cannot be
  overwritten by a concurrent re-save.

Stock decrement keeps its race-safety: `WHERE product_id = $1 AND current_stock >= $2`
is evaluated by PostgreSQL while the row is locked, so concurrent checkouts cannot
oversell.

## Query translation notes

- `$in` → `= ANY($n)`; array `$in` → `&&` (overlap, uses the GIN index on `tags`).
- Case-insensitive `RegExp` purity match → `lower(purity) = ANY(...)`.
- Mongo `$text` search → `ILIKE` across name/description/material/category/tags.
  Slightly more permissive (it also matches partial words); a `tsvector` column
  would be the upgrade path if ranking is ever needed.
- `.skip()/.limit()` → `OFFSET`/`LIMIT`, always with a stable `id` tiebreaker in
  `ORDER BY` so infinite scroll cannot show duplicates or gaps.
- Partial/expression unique indexes must be restated in `ON CONFLICT`:
  `(name, COALESCE(parent, ''))` for categories, `(rate_date, metal, COALESCE(karat, -1))`
  for metal rates.
- `parent IS NOT DISTINCT FROM $2` where a nullable column is matched against a
  possibly-null value.
- Mongo's TTL index on OTP codes has no PostgreSQL equivalent; expired rows are
  swept opportunistically on the (infrequent) code-issue path.

## Service-layer edits

Kept to the minimum needed to remove Mongoose:

- `birthdayWish.service.ts` and `inventory.service.ts` queried Mongoose models
  directly, bypassing the repository boundary. They now use
  `UserRepository.findCelebrationCandidates()`, `ProductRepository.findById()` and
  `InventoryRepository.countTransactionsSince()`.
- `savings.service.ts` no longer wraps `cancelledBy` in an ObjectId; `.toObject()`
  calls in `savings.service.ts` / `return.service.ts` were dropped (repositories
  already return plain objects).
- `product.service.ts` maps PostgreSQL's `23505` unique violation to the existing
  409 (the Mongo `11000` check is retained alongside it).
- Type-only imports moved from `src/models/*` to `src/domain/*`.
- `resolvePurityFraction` and two WhatsApp helpers widened to accept `null`, since
  SQL nulls surface as `null` rather than `undefined`.

## Testing

`npm test` — 21 suites / 235 tests, no database required.

New PostgreSQL coverage:

| Suite | Covers |
| --- | --- |
| `postgres-pool.test.ts` | BEGIN/COMMIT/ROLLBACK, client release on every path, rollback failure not masking the original error, health check returning false instead of throwing |
| `postgres-repositories.test.ts` | get-by-id, list, update, delete, sorting, not-found, legacy-ObjectId handling, constraint-aware upserts, row→domain mapping, parameterization |
| `product-pagination.repo.test.ts` | LIMIT/OFFSET translation, cap, filtering, injection safety |
| `savings-ledger.test.ts` | ledger writes, passbook minting, running-total adjustment — asserted on the SQL issued inside the transaction |

`npm run migration:verify` is a **read-only** script that executes every
repository's main read path against the live database. Unit tests prove the SQL
we intend to send; this proves PostgreSQL accepts it.

## Known limitations

- **Row counts.** Only the core tables were populated by the earlier data
  migration (users, categories, products, product images, carts, metal rates,
  rate status, store config). `scheme_plans` is empty, so savings enrollment
  needs `npm run seed:scheme-plans -- --apply` before use; `inventory` is empty,
  so `npm run seed:inventory` should be run to backfill stock from
  `products.quantity`. Both scripts are idempotent.
- **`Product.quantity` is retained**, per spec §25, until inventory behaviour is
  fully reconciled. `inventory.current_stock` is authoritative once a row exists.
- **Orphaned image files.** Replacing a product's gallery deletes the rows but
  leaves the old WebP files on disk. Deliberate — reclaiming them safely needs a
  sweep that knows no other row references them.
- **`findFeatured` still ignores `is_featured`** and returns the ten newest active
  products. That is pre-existing behaviour the storefront depends on; it was
  preserved rather than corrected here (spec §45).
- **Deployment is out of scope** for this change, per spec §48.
