-- ============================================================================
-- 2026-08-30 business requirements — schema migration
-- ============================================================================
-- Covers:
--   Item 1: mobile OTP verification at signup      -> users.phone_verified
--   Item 2: ID proof (KYC) verification             -> new user_id_proofs table
--   Item 4: KV Smart Purchase Plan (flexible pay)    -> scheme_plans.payment_mode,
--                                                        scheme_plans.min_payment_amount
--
-- Every statement is idempotent (IF NOT EXISTS / guarded) — safe to re-run.
-- Wrapped in one transaction so a failure on any statement rolls back the whole
-- thing rather than leaving a partially-applied schema.
--
-- Run it with:
--   psql "$POSTGRES_URL" -f docs/16-pending-schema-changes.sql
-- (or paste the body into any Postgres client connected to the kvs_ecommerce db).
--
-- AFTER this succeeds, seed/rename the scheme-plan catalog rows (this needs the
-- columns added below, and reuses the existing, already-tested seed script rather
-- than duplicating its logic here in raw SQL):
--   cd kv-api
--   npm run seed:scheme-plans -- --apply
-- That single idempotent run does three things: renames "Gold 11+1"/"Silver 11+1"
-- to "Gold/Silver Purchase Plan" (only if a row still has the old default name —
-- never touches an admin's own edit), creates the new SILVER_SMART ("KV Smart
-- Purchase Plan") row if it doesn't exist yet, and leaves everything else alone.
--
-- Once both steps are done, regenerate docs/14-POSTGRES_SCHEMA.md (its own header
-- explains how) and delete this file + docs/16-pending-schema-changes.md, since
-- they'll no longer be "pending" at that point.
-- ============================================================================

BEGIN;

-- ── Item 1: mobile OTP verification ────────────────────────────────────────
-- src/repositories/user.repository.ts reads/writes this as `phoneVerified`.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

-- ── Item 2: ID proof (KYC) verification ────────────────────────────────────
-- One row per user (not per savings scheme — a single submission covers every
-- scheme a customer enrolls in). Mirrors the existing "detail table with a FK
-- back to its owner" pattern (e.g. savings_cancellations). Columns match
-- src/repositories/idProof.repository.ts exactly.
CREATE TABLE IF NOT EXISTS user_id_proofs (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             bigint NOT NULL UNIQUE REFERENCES users(id),
  id_proof_type       varchar(30) NOT NULL,
  id_proof_number     varchar(100) NOT NULL,
  -- Public URL only — the document photo is written to disk by persistImage()
  -- (same convention as product_images.image_url), never stored as binary/base64.
  image_url           text NOT NULL,
  verification_status varchar(20) NOT NULL DEFAULT 'Pending',
  verified_by         bigint REFERENCES users(id),
  verified_at         timestamp with time zone,
  rejection_reason    text,
  created_at          timestamp with time zone NOT NULL DEFAULT now(),
  updated_at          timestamp with time zone NOT NULL DEFAULT now()
);

-- Speeds up the admin review queue's `WHERE verification_status = 'Pending'` filter.
CREATE INDEX IF NOT EXISTS idx_user_id_proofs_status
  ON user_id_proofs (verification_status);

-- ── Item 4: KV Smart Purchase Plan (flexible pay-anytime scheme) ──────────
-- No new table — reuses the existing scheme_plans catalog, just with a different
-- payment mode. `type`/`scheme_type` are plain varchar (no ENUM/CHECK constraint
-- exists on either table), so the new SILVER_SMART scheme type itself needs no
-- DDL — only these two columns do. Columns match
-- src/repositories/schemePlan.repository.ts exactly.
ALTER TABLE scheme_plans
  ADD COLUMN IF NOT EXISTS payment_mode varchar(20) NOT NULL DEFAULT 'FIXED';

ALTER TABLE scheme_plans
  ADD COLUMN IF NOT EXISTS min_payment_amount numeric(14,2);

COMMIT;

-- ── Verification (optional) ────────────────────────────────────────────────
-- Run these separately after COMMIT to confirm everything landed:
--
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'users' AND column_name = 'phone_verified';
--
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'scheme_plans' AND column_name IN ('payment_mode', 'min_payment_amount');
--
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'user_id_proofs';
