import mongoose, { Schema, Document, Model } from 'mongoose';
import { SchemeType, SchemeMetal } from './schemePlan.model';

export interface ISavingsPayment {
  month: number;
  /** Cash actually collected this row. 0 on the auto-credited bonus/devident row. */
  amount: number;
  paidAt: Date;
  /** ₹/gram used to convert `amount` into the scheme's metal — 0 on the bonus row (no real collection). */
  materialRate: number;
  /** `amount / materialRate`, rounded to 3dp — 0 on the bonus row. */
  materialWeight: number;
  /** Dividend/bonus ₹ credited on this row, if any. 0 on ordinary collection rows. */
  devidentAmount: number;
  /** ₹/gram used to convert `devidentAmount` into the scheme's metal. 0 when there's no devident. */
  devidentMaterialRate: number;
  /** `devidentAmount / devidentMaterialRate`, rounded to 3dp. 0 when there's no devident. */
  devidentMaterialWeight: number;
  /** How this installment was collected. */
  method: 'ONLINE' | 'CASH';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  /** Admin/staff user who entered a CASH row. Unset for ONLINE rows and the auto-credited bonus row. */
  recordedBy?: mongoose.Types.ObjectId;
  /** IST 'YYYY-MM' this collection was actually MADE in — enforces "one installment per
   * calendar month" (card rule 3): a second real payment can't land in the same month, even
   * as a late catch-up. Unset on the auto-credited bonus row. */
  dueMonthKey?: string;
}

export interface IMaturityBenefits {
  /** ₹ value of the gold portion of the payout. For DIWALI this is computed at redemption —
   * see SavingsService.computeDiwaliRedemption — as (totalPaid + 1 bonus month) minus
   * giftsValue minus the silver coin's value at that day's rate; it is NOT a fixed amount set
   * at enrollment. For GOLD_11_1/SILVER_11_1 (unused today) it would be admin-entered. */
  goldCoinValue?: number;
  /** Grams of gold `goldCoinValue` bought at `goldRatePerGram` — the actual weight handed
   * over. Computed alongside `goldCoinValue`, never independently. */
  goldGrams?: number;
  /** ₹/gram gold rate used to convert `goldCoinValue` → `goldGrams` at redemption time. */
  goldRatePerGram?: number;
  /** Grams of silver coin/article awarded at scheme maturity (fixed weight, from the plan's
   * hamper — its ₹ value floats with the rate, computed below). */
  silverGrams?: number;
  /** ₹ value of `silverGrams` at `silverRatePerGram`, as of redemption. */
  silverValue?: number;
  silverRatePerGram?: number;
  /** ₹ cost of the fixed gift package, from the plan's hamper.giftsValue. */
  giftsValue?: number;
  /** Free-text extras, e.g. ["Crackers Box", "Sweets and Snacks", "Soubhagya Gift equivalent to Scheme Amount"]. */
  gifts?: string[];
  /** When the DIWALI redemption payout above was computed (admin-triggered, ahead of the
   * festival, once the scheme has completed all installments). Unset until then. */
  computedAt?: Date;
}

/** Card rule 6: stopping before completing the scheme forfeits a % of what was paid (plus the
 * value of any gifts already handed over), and the remainder is redeemable as goods only —
 * never cash. Set once, when the scheme is cancelled. */
export interface ICancellation {
  cancelledAt: Date;
  amountPaidAtCancellation: number;
  penaltyPercent: number;
  penaltyAmount: number;
  giftsValueDeducted: number;
  netRedeemable: number;
  note?: string;
  cancelledBy: mongoose.Types.ObjectId;
}

export interface ISavings extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Unset until the scheme's first payment lands — see SavingsRepository.recordPayment. */
  passbookNumber?: string;
  /** Which of the catalog products this enrollment is under — drives rate resolution, bonus,
   * penalty %, and passbook prefix. Defaults to SILVER_11_1 for schemes created before this
   * field existed (see the backfill migration). */
  schemeType: SchemeType;
  /** The SchemePlan this enrollment was created against, at enrollment time. Plans can change
   * later; this enrollment keeps operating on the terms captured on its own fields below. */
  planId?: mongoose.Types.ObjectId;
  /** Which metal installments accumulate as. Unset for DIWALI (fixed hamper, not gram-based). */
  metal?: SchemeMetal;
  planName: string;
  monthlyAmount: number;
  duration: number;
  bonusAmount: number;
  totalPaid: number;
  status: 'Active' | 'Completed' | 'Cancelled' | 'Dropped';
  payments: ISavingsPayment[];
  /** Admin-configurable reward shown on the passbook once the scheme matures. For DIWALI this
   * is populated from the plan's hamper at enrollment time. */
  maturityBenefits?: IMaturityBenefits;
  cancellation?: ICancellation;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SavingsPaymentSchema = new Schema<ISavingsPayment>(
  {
    month: { type: Number, required: true },
    amount: { type: Number, required: true, default: 0 },
    paidAt: { type: Date, default: Date.now },
    materialRate: { type: Number, required: true, default: 0 },
    materialWeight: { type: Number, required: true, default: 0 },
    devidentAmount: { type: Number, required: true, default: 0 },
    devidentMaterialRate: { type: Number, required: true, default: 0 },
    devidentMaterialWeight: { type: Number, required: true, default: 0 },
    method: { type: String, enum: ['ONLINE', 'CASH'], default: 'ONLINE' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    dueMonthKey: { type: String },
  },
  { _id: false },
);

const MaturityBenefitsSchema = new Schema<IMaturityBenefits>(
  {
    goldCoinValue: { type: Number },
    goldGrams: { type: Number },
    goldRatePerGram: { type: Number },
    silverGrams: { type: Number },
    silverValue: { type: Number },
    silverRatePerGram: { type: Number },
    giftsValue: { type: Number },
    gifts: { type: [String], default: [] },
    computedAt: { type: Date },
  },
  { _id: false },
);

const CancellationSchema = new Schema<ICancellation>(
  {
    cancelledAt: { type: Date, required: true, default: Date.now },
    amountPaidAtCancellation: { type: Number, required: true },
    penaltyPercent: { type: Number, required: true },
    penaltyAmount: { type: Number, required: true },
    giftsValueDeducted: { type: Number, required: true, default: 0 },
    netRedeemable: { type: Number, required: true },
    note: { type: String },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false },
);

const SavingsSchema = new Schema<ISavings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    passbookNumber: { type: String, unique: true, sparse: true },
    schemeType: {
      type: String,
      required: true,
      enum: ['GOLD_11_1', 'SILVER_11_1', 'DIWALI', 'GOLD_INCOME', 'SILVER_DEPOSIT'],
      default: 'SILVER_11_1',
    },
    planId: { type: Schema.Types.ObjectId, ref: 'SchemePlan' },
    metal: { type: String, enum: ['GOLD', 'SILVER'] },
    planName: { type: String, required: true },
    monthlyAmount: { type: Number, required: true },
    duration: { type: Number, required: true },
    bonusAmount: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ['Active', 'Completed', 'Cancelled', 'Dropped'],
      default: 'Active',
    },
    payments: { type: [SavingsPaymentSchema], default: [] },
    maturityBenefits: { type: MaturityBenefitsSchema },
    cancellation: { type: CancellationSchema },
    startDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

SavingsSchema.index({ userId: 1 });
SavingsSchema.index({ schemeType: 1 });

export const Savings: Model<ISavings> = mongoose.model<ISavings>('Savings', SavingsSchema);
