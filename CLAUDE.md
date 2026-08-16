# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.

---

## Commands

```bash
npm run dev          # ts-node-dev with hot reload
npm run build        # rimraf dist && tsc
npm start            # node dist/server.js
npm test             # jest --runInBand (must be serial)
npm run test:watch
npm run seed         # ts-node src/seed.ts — seeds the admin/staff accounts
npm run seed:inventory       # backfill inventory rows from products.quantity
npm run seed:scheme-plans    # savings plan catalog (dry run; add -- --apply to write)

# Run a single test file
npx jest src/tests/admin-orders.api.test.ts --runInBand

# Migration / verification tooling (see "Migration tooling" below)
npm run migration:verify         # READ-ONLY: run every repository read path against PostgreSQL
npm run migration:test-postgres  # connection smoke test
```

## Architecture

**Stack:** Node.js + Express 5 + TypeScript + PostgreSQL 17 (`pg`, no ORM)

**Request flow:** `Route → Controller → Service → Repository → PostgreSQL`

- `src/routes/index.ts` — aggregates all route modules, mounted at `/api/v1`
- `src/controllers/` — parse req, call service, send res
- `src/services/` — business logic, orchestrates repository calls
- `src/repositories/` — all data access, hand-written parameterized SQL
- `src/domain/` — plain TypeScript interfaces for every aggregate (no ORM types)
- `src/infrastructure/postgres/pool.ts` — the ONLY place a `pg.Pool` is created
- `src/infrastructure/postgres/mapping.ts` — shared row→domain coercion helpers
- `src/infrastructure/storage/productImages.ts` — writes uploaded images to disk

**Repository rules (non-negotiable):**
- Every query is parameterized (`$1`, `$2`, …). Never interpolate user input.
- Services contain business logic; repositories contain SQL. Neither crosses over.
- `pg` types (`QueryResult`, `PoolClient`) never escape a repository.
- Repositories return domain objects whose `_id` is a **string** holding the
  PostgreSQL BIGINT. The key stayed `_id` so services and response mappers
  didn't have to change; `legacy_mongo_id` is reconciliation-only and must never
  drive business logic.
- Use `withTransaction` for anything that must be atomic (orders + items + stock,
  payment confirmation, savings installments, passbook minting).

**Auth:** `src/middlewares/auth.middleware.ts` exports `protect` (JWT required) and `admin` (role check). Guards extend `express.Request` as `AuthRequest`.

**Config:** All env vars centralized in `src/config/index.ts` — every value is read from `process.env` here and nowhere else. Import `config` rather than touching `process.env` directly.

**Error handling:** Throw `AppError` from anywhere — `src/middlewares/error.middleware.ts` catches globally.

**Swagger:** JSDoc annotations in route files → available at `http://localhost:5000/api-docs`.

**Payments:** Razorpay integration has no `razorpay` SDK dependency — order creation and signature verification in `src/services/payment.service.ts` use Node's native `crypto` (HMAC-SHA256) directly.

**Email:** Transactional email goes through Brevo SMTP via Nodemailer. `src/utils/email.ts` is the low-level sender; `src/utils/emailNotifications.ts` holds the templated senders (order created, payment completed, contact-us, new-product promo). These are best-effort — failures are logged, not thrown.

## Database

- **PostgreSQL 17 only.** Connection string via `POSTGRES_URL`; the pool refuses to
  start without it. Pool sizing/timeouts are configurable (see the env table).
- The schema lives on the server, not in this repo. `docs/14-POSTGRES_SCHEMA.md`
  is the checked-in reference; regenerate it if the schema changes.
- **Numeric handling:** `pool.ts` installs type parsers so `DATE` stays a
  `'YYYY-MM-DD'` string (calendar days must not drift across timezones) and
  `NUMERIC` parses to `number` (matching the pre-migration behaviour). `BIGINT`
  stays a string and is surfaced as a string id.
- **Product images are never stored in the database.** `product_images.image_url`
  holds a public path served by Nginx from `IMAGE_STORAGE_ROOT`. Admin uploads
  still arrive as base64 and are converted to WebP on the write path; nothing
  base64 is ever read back. Reads expose the URL under BOTH `imageUrl` and the
  legacy `imageBase64` key so existing clients keep rendering.

## Migration tooling

`src/migration/` is the ONLY place Mongoose still exists, and it is not part of
the runtime. It holds the one-off MongoDB → PostgreSQL scripts plus the legacy
Mongoose models they need (`src/migration/models/`). `MONGO_URI` and
`POSTGRES_MIGRATION_URL` serve these scripts only — runtime code reads neither.

`npm run migration:verify` is read-only and worth running after any repository
change: it executes every repository's main read path against the real database,
so a bad column name surfaces there rather than in production.

**Older legacy artifacts, not used at runtime:** `database/sqlserver/*.sql` are
leftovers from an even earlier SQL Server → MongoDB migration. Ignore these.

## Testing

Tests in `src/tests/` use `jest` + `supertest` and need no database. Most mock at
the repository layer; the PostgreSQL-specific suites
(`postgres-pool.test.ts`, `postgres-repositories.test.ts`,
`product-pagination.repo.test.ts`, `savings-ledger.test.ts`) mock
`src/infrastructure/postgres/pool` instead and assert on the SQL actually issued.
Always use `--runInBand` to prevent parallel test interference.

Tests must be deterministic — do not call `new Date()` for "now" in a test whose
subject branches on the date (the rate guard is exempt on Sundays IST, which
silently broke three cases every seventh day). Pin a fixed date instead.

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `POSTGRES_URL` | **Runtime** PostgreSQL connection string (required) |
| `POSTGRES_POOL_MAX` | Pool size, default 10 |
| `POSTGRES_IDLE_TIMEOUT_MS` / `POSTGRES_CONNECTION_TIMEOUT_MS` / `POSTGRES_STATEMENT_TIMEOUT_MS` | Pool tuning (30s / 10s / 30s) |
| `POSTGRES_SSL` | `true` to enable TLS |
| `IMAGE_STORAGE_ROOT` / `IMAGE_PUBLIC_BASE` | Where product images are written / the URL prefix Nginx maps to it |
| `MONGO_URI` / `POSTGRES_MIGRATION_URL` | **Migration scripts only** — not read at runtime |
| `JWT_SECRET` | Token signing |
| `CORS_ORIGINS` | Comma-separated origins (`*` for all) |
| `PORT` | Default 5000 |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay payments |
| `BREVO_SMTP_USER` / `BREVO_SMTP_PASSWORD` / `BREVO_SENDER_EMAIL` | Nodemailer via Brevo SMTP |
