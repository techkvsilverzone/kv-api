-- ============================================================================
-- 2026-08-30 business requirements — data seed (companion to
-- 16-pending-schema-changes.sql, run AFTER that migration succeeds)
-- ============================================================================
-- This is the SQL equivalent of `npm run seed:scheme-plans -- --apply`
-- (src/utils/seedSchemePlans.ts), written directly against the database instead
-- of running the Node script on the server — avoids deploying this session's
-- application code changes to production just to seed a few catalog rows. If the
-- API is later redeployed with the updated seedSchemePlans.ts, re-running it is
-- harmless: both the renames and the insert are guarded exactly the same way
-- (only rename a name that still matches the OLD default; only insert if the
-- type doesn't exist yet), so it will find nothing left to do.
--
-- Run it with:
--   psql "$POSTGRES_URL" -f docs/16-pending-schema-changes-data.sql
-- ============================================================================

BEGIN;

-- Item 3: rename plan display names — only if still on the original seed
-- default, so an admin's own edit (via the Scheme Plans panel) is never touched.
UPDATE scheme_plans SET name = 'Gold Purchase Plan', updated_at = NOW()
  WHERE type = 'GOLD_11_1' AND name = 'Gold 11+1';

UPDATE scheme_plans SET name = 'Silver Purchase Plan', updated_at = NOW()
  WHERE type = 'SILVER_11_1' AND name = 'Silver 11+1';

-- Item 4: seed the KV Smart Purchase Plan catalog row — only if it doesn't
-- already exist. Values match src/utils/seedSchemePlans.ts PLAN_SEEDS exactly,
-- EXCEPT is_active is FALSE here (the seed script defaults it to true): the
-- application code that actually understands FLEXIBLE-mode plans is not yet
-- deployed to this server, only this schema/data migration is. The currently
-- running (old) API code would show this plan on the live storefront but reject
-- every enrollment attempt (its enroll() checks amount against monthlyAmounts,
-- which is empty for this plan) — confusing for a real customer. Flip
-- is_active to true (Admin > Scheme Plans, or `UPDATE scheme_plans SET
-- is_active = true WHERE type = 'SILVER_SMART';`) once the updated API code is
-- actually deployed and live.
INSERT INTO scheme_plans (
  type, name, description, is_active, metal, duration_months, bonus_months,
  payment_mode, min_payment_amount, passbook_prefix, payment_due_day_of_month,
  early_exit_penalty_percent, redemption_mode, sort_order
)
SELECT
  'SILVER_SMART',
  'KV Smart Purchase Plan',
  'Pay any amount, any time, as often as you like — for 11 months from enrollment. Every payment converts to silver grams at that day''s rate. Redeemable for silver articles or bars only.',
  false,
  'SILVER',
  11,
  0,
  'FLEXIBLE',
  100,
  'SMT',
  10,
  10,
  'GOODS_ONLY',
  4
WHERE NOT EXISTS (SELECT 1 FROM scheme_plans WHERE type = 'SILVER_SMART');

COMMIT;

-- ── Verification (optional) ────────────────────────────────────────────────
-- SELECT type, name, payment_mode, min_payment_amount FROM scheme_plans ORDER BY sort_order;
