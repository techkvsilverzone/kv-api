# Pending schema changes (2026-08-30 business requirements)

This repo doesn't check in the live schema — `docs/14-POSTGRES_SCHEMA.md` is a checked-in
**snapshot**, and past schema changes were applied directly against the database (the dev
machine's SSH tunnel to `localhost:15432` was live at the time). This session's
`migration:test-postgres` came back `PostgreSQL connection failed` — no tunnel was reachable from
here (checked from both the sandboxed shell and native PowerShell) — so the changes are written
but **NOT applied**.

**The executable migration lives in [`16-pending-schema-changes.sql`](16-pending-schema-changes.sql)
in this same folder.** Run it from a machine with DB access:

```bash
psql "$POSTGRES_URL" -f docs/16-pending-schema-changes.sql
```

Then seed/rename the scheme-plan catalog rows (needs the columns the `.sql` file just added):

```bash
cd kv-api
npm run seed:scheme-plans -- --apply
```

Every statement in the `.sql` file is idempotent (`IF NOT EXISTS` / guarded), wrapped in one
transaction, and safe to re-run. After both steps succeed, regenerate `docs/14-POSTGRES_SCHEMA.md`
per its own instructions and delete both this file and `16-pending-schema-changes.sql`, since
they'll no longer be "pending" at that point.

## Item 1 — Mobile OTP verification at signup

Adds `users.phone_verified`. No other tables affected — `otp_codes` already stores an arbitrary
`identifier`/`purpose` pair (see `src/domain/otp.ts`), so a `phone_verify`-purpose code keyed by
the phone number itself needs no schema change there.

## Item 2 — ID proof (KYC) verification, required once per customer before enrollment

Adds a new `user_id_proofs` table — one row per user (not per scheme — the same submission
covers every scheme a customer joins; see `src/services/savings.service.ts enroll()`), following
the `savings_cancellations`-style "detail table with a FK back to its owner" pattern already used
elsewhere in this schema.

`image_url` follows the exact same convention as `product_images.image_url` — the document photo
is converted to WebP on disk by `persistImage()` (`src/infrastructure/storage/productImages.ts`,
reused as-is) under `<IMAGE_STORAGE_ROOT>/id-proofs/<userId>/`, never stored as binary/base64 in
the database.

## Item 4 — KV Smart Purchase Plan (flexible pay-anytime scheme)

Adds two new columns on the existing `scheme_plans` table — no new table needed, since this
reuses the same catalog as Gold/Silver 11+1/Diwali, just with a different payment mode.

`scheme_type`/`type` and `scheme_plans.type` are plain `varchar`, NOT a Postgres `ENUM` or a
`CHECK`-constrained column (confirmed against `docs/14-POSTGRES_SCHEMA.md` — no such constraint
is listed for either table), so the new `SILVER_SMART` scheme type needs no DDL of its own —
it's accepted the moment the seed script (`npm run seed:scheme-plans -- --apply`) inserts a row
with that value.

No `savings_accounts`/`savings_payments` schema change: a FLEXIBLE scheme's `payments` rows use
the exact same columns as every other scheme (amount/materialRate/materialWeight/paidAt/etc) —
only the business rules in `SavingsService` differ (no fixed monthly amount, no one-per-month
restriction, capped by the enrollment-date + duration window instead of a payment count). See
`src/services/savings.service.ts` (`applyPayment`, `createInstallmentOrder`,
`verifyAndRecordInstallment`) for exactly where each rule branches on `plan.paymentMode`.
