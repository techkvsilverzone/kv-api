# Schema changes for the 2026-08-30 business requirements

## Status: schema + data APPLIED to production; application code NOT yet deployed

Applied directly against the live production database (`kvs_ecommerce` in the `kvs-postgres`
docker container on `200.141.6.59`, via `ssh deploy@200.141.6.59` +
`docker exec -i kvs-postgres psql ...`) on 2026-08-30:

1. `16-pending-schema-changes.sql` — schema (columns/table/constraint widening). Applied.
2. `16-pending-schema-changes-data.sql` — data (plan renames + the new SILVER_SMART row). Applied.

**What this means right now:** the database already has everything the NEW application code
needs. The currently-DEPLOYED API code (on `/opt/kvs/api/kv-api`) is still the OLD code and knows
nothing about `phone_verified`, `user_id_proofs`, or `payment_mode` — it simply doesn't read those
columns, so it keeps working exactly as before. The one deliberate exception: the new
**"KV Smart Purchase Plan" row was seeded with `is_active = false`**, specifically so the old
deployed code (which doesn't understand `FLEXIBLE` mode) never shows it on the live storefront —
flip it to `true` (`UPDATE scheme_plans SET is_active = true WHERE type = 'SILVER_SMART';`, or via
Admin > Scheme Plans) only once the new API code is actually deployed and live.

**Still to do, and NOT done as part of this migration:** deploying the actual TypeScript changes
(OTP/KYC/flexible-plan logic — this session's git commits) to `/opt/kvs/api/kv-api` and
`/opt/kvs/web/kv-ui`, and restarting/rebuilding those services. That's a separate action from a
database migration and needs its own explicit go-ahead.

Every statement in both `.sql` files is idempotent (`IF NOT EXISTS` / guarded) and wrapped in a
transaction — safe to re-run against production or any other environment (e.g. local dev) without
side effects. Once the code above is deployed and `SILVER_SMART` is flipped active, regenerate
`docs/14-POSTGRES_SCHEMA.md` per its own instructions and delete both `.sql` files plus this doc,
since they'll no longer be "pending" at that point.

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

`scheme_plans.type` DOES have a CHECK constraint (`ck_scheme_plans_type`) restricting it to the
5 pre-existing scheme types — discovered live on 2026-08-30 when first applying this migration
against production; the `docs/14-POSTGRES_SCHEMA.md` snapshot this doc originally relied on
didn't list it (that snapshot is stale/incomplete on this point). The `.sql` file widens it to
admit `SILVER_SMART`. `savings_accounts.scheme_type` has no equivalent constraint (confirmed live
via `pg_constraint`), so nothing there needed changing.

No `savings_accounts`/`savings_payments` schema change: a FLEXIBLE scheme's `payments` rows use
the exact same columns as every other scheme (amount/materialRate/materialWeight/paidAt/etc) —
only the business rules in `SavingsService` differ (no fixed monthly amount, no one-per-month
restriction, capped by the enrollment-date + duration window instead of a payment count). See
`src/services/savings.service.ts` (`applyPayment`, `createInstallmentOrder`,
`verifyAndRecordInstallment`) for exactly where each rule branches on `plan.paymentMode`.
