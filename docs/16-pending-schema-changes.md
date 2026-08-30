# Pending schema changes (2026-08-30 business requirements)

This repo doesn't check in the live schema — `docs/14-POSTGRES_SCHEMA.md` is a checked-in
**snapshot**, and past schema changes were applied directly against the database (the dev
machine's SSH tunnel to `localhost:15432` was live at the time). This session's `migration:test-postgres`
came back `PostgreSQL connection failed` — no tunnel is up from here — so the statements below
are written but **NOT applied**. Run them against the real database (from a machine with the
tunnel/credentials) before the corresponding feature will work end-to-end; the application code
in this PR already assumes these columns/tables exist.

Every statement is idempotent (`IF NOT EXISTS` / guarded) so it's safe to run more than once.
After applying, regenerate `docs/14-POSTGRES_SCHEMA.md` per its own instructions and delete the
section below once it's no longer pending.

## Item 1 — Mobile OTP verification at signup

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;
```

No other tables affected — `otp_codes` already stores an arbitrary `identifier`/`purpose` pair
(see `src/domain/otp.ts`), so a `phone_verify`-purpose code keyed by the phone number itself
needs no schema change there.

## Item 2 — ID proof (KYC) verification, required once per customer before enrollment

One row per user (not per scheme — the same submission covers every scheme a customer joins;
see `src/services/savings.service.ts enroll()`), following the `savings_cancellations`-style
"detail table with a FK back to its owner" pattern already used elsewhere in this schema.

```sql
CREATE TABLE IF NOT EXISTS user_id_proofs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL UNIQUE REFERENCES users(id),
  id_proof_type varchar(30) NOT NULL,
  id_proof_number varchar(100) NOT NULL,
  image_url text NOT NULL,
  verification_status varchar(20) NOT NULL DEFAULT 'Pending',
  verified_by bigint REFERENCES users(id),
  verified_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
```

`image_url` follows the exact same convention as `product_images.image_url` — the document photo
is converted to WebP on disk by `persistImage()` (`src/infrastructure/storage/productImages.ts`,
reused as-is) under `<IMAGE_STORAGE_ROOT>/id-proofs/<userId>/`, never stored as binary/base64 in
the database.

## Item 4 — KV Smart Purchase Plan (flexible pay-anytime scheme)

Two new columns on the existing `scheme_plans` table — no new table needed, since this reuses
the same catalog as Gold/Silver 11+1/Diwali, just with a different payment mode.

```sql
ALTER TABLE scheme_plans ADD COLUMN IF NOT EXISTS payment_mode varchar(20) NOT NULL DEFAULT 'FIXED';
ALTER TABLE scheme_plans ADD COLUMN IF NOT EXISTS min_payment_amount numeric(14,2);
```

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
