import mongoose, { Schema, Document, Model } from 'mongoose';

/** All five savings products the shop runs. Only the first three (self-service,
 * installment-based) are seeded/enrollable today — GOLD_INCOME/SILVER_DEPOSIT are lump-sum
 * deposit schemes reserved for a later phase. */
export type SchemeType = 'GOLD_11_1' | 'SILVER_11_1' | 'DIWALI' | 'GOLD_INCOME' | 'SILVER_DEPOSIT';
export type SchemeMetal = 'GOLD' | 'SILVER';

export interface ISchemeHamper {
  /** Hallmark purity of the gold portion of the payout, e.g. "916". Gold itself is NOT a
   * fixed weight — see the redemption formula in savings.service.ts: the customer is owed a
   * fixed ₹ VALUE (total paid + 1 bonus month, minus giftsValue and the silver coin's value),
   * converted to however many grams that buys at the gold rate on the day of redemption. This
   * is what keeps the scheme fair regardless of how gold moves between enrollment and Diwali. */
  goldCoinPurity?: string;
  /** Fixed weight of the silver coin included in the hamper — grams, not value (its ₹ value
   * floats with the silver rate and is computed at redemption time). */
  silverCoinGrams?: number;
  /** ₹ cost of the fixed gift package (crackers, sweets/savories, gifts) — a flat amount per
   * plan, not scaled per customer; the shop sources roughly the same hamper regardless of the
   * monthly amount chosen. Subtracted from the total payout value before computing gold. */
  giftsValue?: number;
  /** Free-text description of what's in the gift package — "Crackers Box", "Sweets and
   * Savories", "Gift" — display only, doesn't drive the money math (giftsValue does). */
  gifts?: string[];
}

export interface ISchemePlan extends Document {
  _id: mongoose.Types.ObjectId;
  type: SchemeType;
  name: string;
  description?: string;
  isActive: boolean;
  /** Which metal installments accumulate as. Unset for DIWALI (fixed hamper, not gram-based). */
  metal?: SchemeMetal;
  durationMonths: number;
  /** Extra bonus months auto-credited on completion (1 for the "+1" schemes, 0 otherwise). */
  bonusMonths: number;
  /** Selectable fixed monthly amounts, e.g. [3000, 5000, 7000] — matches the printed cards. */
  monthlyAmounts: number[];
  passbookPrefix: string;
  /** Card rule: installment due by this day of the month. */
  paymentDueDayOfMonth: number;
  /** Card rule: % of amount paid forfeited on early exit. */
  earlyExitPenaltyPercent: number;
  /** Diwali rule: consecutive missed months before the member is dropped. */
  maxConsecutiveMissedMonths?: number;
  /** Card rule: maturity/exit value is redeemable as goods only, never cash. */
  redemptionMode: 'GOODS_ONLY' | 'CASH_ALLOWED';
  /** Diwali-only reward package (fixed gifts + silver coin weight; gold is value-based — see
   * ISchemeHamper.goldCoinPurity). */
  hamper?: ISchemeHamper;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SchemeHamperSchema = new Schema<ISchemeHamper>(
  {
    goldCoinPurity: { type: String },
    silverCoinGrams: { type: Number },
    giftsValue: { type: Number },
    gifts: { type: [String], default: [] },
  },
  { _id: false },
);

const SchemePlanSchema = new Schema<ISchemePlan>(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      enum: ['GOLD_11_1', 'SILVER_11_1', 'DIWALI', 'GOLD_INCOME', 'SILVER_DEPOSIT'],
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    metal: { type: String, enum: ['GOLD', 'SILVER'] },
    durationMonths: { type: Number, required: true },
    bonusMonths: { type: Number, default: 0 },
    monthlyAmounts: { type: [Number], default: [] },
    passbookPrefix: { type: String, required: true, uppercase: true, trim: true },
    paymentDueDayOfMonth: { type: Number, default: 10 },
    earlyExitPenaltyPercent: { type: Number, default: 10 },
    maxConsecutiveMissedMonths: { type: Number },
    redemptionMode: { type: String, enum: ['GOODS_ONLY', 'CASH_ALLOWED'], default: 'GOODS_ONLY' },
    hamper: { type: SchemeHamperSchema },
    sortOrder: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const SchemePlan: Model<ISchemePlan> = mongoose.model<ISchemePlan>('SchemePlan', SchemePlanSchema);
