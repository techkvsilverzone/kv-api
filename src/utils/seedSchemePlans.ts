import { connectMongo, disconnectMongo } from './db';
import { SchemePlan, ISchemePlan, SchemeType } from '../models/schemePlan.model';
import { Savings } from '../models/savings.model';
import Logger from './logger';

/**
 * Catalog seed for the three self-service scheme types (phase 1 of the savings rework).
 * GOLD_INCOME/SILVER_DEPOSIT (the lump-sum deposit schemes) are intentionally NOT seeded here
 * — they're reserved for a later phase and stay closed to enrollment
 * (SavingsService.ENROLLABLE_TYPES) until then.
 *
 * Amounts/thresholds below are taken from the shop's printed scheme cards
 * (kv-silver-zone/docs/cards/) — admin can edit every field afterward from the Scheme Plans
 * panel; this just gets a sane starting catalog into the database.
 */
const PLAN_SEEDS: Array<Partial<ISchemePlan> & { type: SchemeType }> = [
  {
    type: 'GOLD_11_1',
    name: 'Gold 11+1',
    description: 'Pay a fixed amount monthly for 11 months, converted to gold grams at each day\'s rate. Redeem for gold/silver jewellery in month 12 at that day\'s market rate.',
    isActive: true,
    metal: 'GOLD',
    durationMonths: 11,
    bonusMonths: 1,
    monthlyAmounts: [3000, 5000, 7000, 10000],
    passbookPrefix: 'GLD',
    paymentDueDayOfMonth: 10,
    earlyExitPenaltyPercent: 10,
    redemptionMode: 'GOODS_ONLY',
    sortOrder: 1,
  },
  {
    type: 'SILVER_11_1',
    name: 'Silver 11+1',
    description: 'Pay a fixed amount monthly for 11 months, converted to silver grams at each day\'s rate. Redeem for silver jewellery/articles in month 12 at that day\'s market rate.',
    isActive: true,
    metal: 'SILVER',
    durationMonths: 11,
    bonusMonths: 1,
    monthlyAmounts: [2000, 3000, 5000, 7000],
    passbookPrefix: 'SLV',
    paymentDueDayOfMonth: 10,
    earlyExitPenaltyPercent: 10,
    redemptionMode: 'GOODS_ONLY',
    sortOrder: 2,
  },
  {
    type: 'DIWALI',
    name: 'Diwali Scheme',
    description: 'Pay a fixed amount monthly for 11 months. At redemption, receive a fixed gift hamper, a silver coin, and gold worth the remainder of (total paid + 1 bonus month) — converted to grams at that day\'s gold rate.',
    isActive: true,
    metal: undefined,
    durationMonths: 11,
    bonusMonths: 0,
    // Matches the owner's confirmed worked example exactly (₹3,000/mo × 11 = ₹33,000 paid →
    // ₹32,000 gold + ₹2,500 gifts + a 30g silver coin). Admin can add more denominations via
    // the Scheme Plans panel — giftsValue/silverCoinGrams apply to whichever amount is chosen.
    monthlyAmounts: [3000],
    passbookPrefix: 'DIW',
    paymentDueDayOfMonth: 10,
    earlyExitPenaltyPercent: 10,
    maxConsecutiveMissedMonths: 3,
    redemptionMode: 'GOODS_ONLY',
    hamper: {
      goldCoinPurity: '916',
      silverCoinGrams: 30,
      giftsValue: 2500,
      gifts: ['Crackers Box', 'Sweets and Savories', 'Gift'],
    },
    sortOrder: 3,
  },
];

interface SeedReport {
  plansCreated: string[];
  plansAlreadyPresent: string[];
  savingsBackfilled: number;
}

/**
 * Idempotent: only creates a plan when its `type` doesn't already exist (never overwrites an
 * admin's edits to a plan already in the DB) and only backfills `Savings` docs that are
 * completely missing `schemeType` (pre-rework enrollments) — anything already stamped is left
 * untouched. Safe to re-run.
 */
export async function seedSchemePlans(options: { apply: boolean }): Promise<SeedReport> {
  const plansCreated: string[] = [];
  const plansAlreadyPresent: string[] = [];

  for (const seed of PLAN_SEEDS) {
    const existing = await SchemePlan.findOne({ type: seed.type });
    if (existing) {
      plansAlreadyPresent.push(seed.type);
      continue;
    }
    plansCreated.push(seed.type);
    if (options.apply) {
      await SchemePlan.create(seed);
    }
  }

  // Pre-rework enrollments predate `schemeType` — they're all silver gram-ledger schemes
  // (the only kind that existed), so backfill them onto SILVER_11_1 and its seeded plan.
  const silverPlan = await SchemePlan.findOne({ type: 'SILVER_11_1' });
  const legacyFilter = { schemeType: { $exists: false } };
  const savingsBackfilled = await Savings.countDocuments(legacyFilter);
  if (options.apply && savingsBackfilled > 0) {
    if (!silverPlan) {
      throw new Error('Cannot backfill legacy Savings docs — SILVER_11_1 plan was not found/created');
    }
    await Savings.updateMany(legacyFilter, {
      $set: { schemeType: 'SILVER_11_1', metal: 'SILVER', planId: silverPlan._id },
    });
  }

  return { plansCreated, plansAlreadyPresent, savingsBackfilled };
}

// `npm run seed:scheme-plans` (dry run) or `npm run seed:scheme-plans -- --apply`
if (require.main === module) {
  const apply = process.argv.includes('--apply');
  (async () => {
    try {
      await connectMongo();
      const report = await seedSchemePlans({ apply });
      Logger.info(`[${apply ? 'APPLY' : 'DRY RUN'}] plans created: ${report.plansCreated.join(', ') || '(none)'}`);
      Logger.info(`[${apply ? 'APPLY' : 'DRY RUN'}] plans already present: ${report.plansAlreadyPresent.join(', ') || '(none)'}`);
      Logger.info(`[${apply ? 'APPLY' : 'DRY RUN'}] legacy Savings docs to backfill onto SILVER_11_1: ${report.savingsBackfilled}`);
      if (!apply) {
        Logger.info('Dry run only — re-run with `-- --apply` to write these changes.');
      }
    } catch (error) {
      Logger.error(`Scheme plan seed failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      await disconnectMongo();
    }
  })();
}
