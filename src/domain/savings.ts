/**
 * Savings domain models.
 *
 * The aggregate is stored relationally — `savings_accounts` plus
 * `savings_payments`, `savings_cancellations` and `savings_maturity_benefits`
 * — never as a serialised blob (spec §23). It is reassembled here into the
 * exact nested shape the savings service and passbook views already consume,
 * so none of the scheme rules had to be touched.
 */

export type SchemeType = 'GOLD_11_1' | 'SILVER_11_1' | 'DIWALI' | 'GOLD_INCOME' | 'SILVER_DEPOSIT' | 'SILVER_SMART';
/**
 * FIXED = pick one of `monthlyAmounts` at enrollment, pay exactly that once per calendar month
 * (the original 3 self-service schemes). FLEXIBLE = "KV Smart Purchase Plan" (item 4, 2026-08-30
 * business requirement) — pay ANY amount >= `minPaymentAmount`, any number of times, any time
 * within the plan's `durationMonths` window from enrollment. No bonus month.
 */
export type SchemePaymentMode = 'FIXED' | 'FLEXIBLE';
export type SchemeMetal = 'GOLD' | 'SILVER';

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
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  /** Admin/staff user who entered a CASH row. Unset for ONLINE rows and the auto-credited bonus row. */
  recordedBy?: string | null;
  /**
   * IST 'YYYY-MM' this collection was actually MADE in — enforces "one
   * installment per calendar month" (card rule 3). Unset on the bonus row.
   */
  dueMonthKey?: string | null;
}

export interface IMaturityBenefits {
  goldCoinValue?: number | null;
  goldGrams?: number | null;
  goldRatePerGram?: number | null;
  silverGrams?: number | null;
  silverValue?: number | null;
  silverRatePerGram?: number | null;
  giftsValue?: number | null;
  gifts?: string[];
  computedAt?: Date | null;
}

/**
 * Card rule 6: stopping before completing the scheme forfeits a % of what was
 * paid (plus the value of any gifts already handed over), and the remainder is
 * redeemable as goods only — never cash. Set once, when the scheme is cancelled.
 */
export interface ICancellation {
  cancelledAt: Date;
  amountPaidAtCancellation: number;
  penaltyPercent: number;
  penaltyAmount: number;
  giftsValueDeducted: number;
  netRedeemable: number;
  note?: string | null;
  cancelledBy: string;
}

/** Present when the query joined the owner, standing in for the old `populate`. */
export interface ISavingsUserRef {
  _id: string;
  name: string;
  email?: string;
  phone?: string | null;
}

export interface ISavings {
  _id: string;
  userId: string | ISavingsUserRef;
  /** Unset until the scheme's first payment lands — see SavingsRepository.recordPayment. */
  passbookNumber?: string | null;
  schemeType: SchemeType;
  planId?: string | null;
  /** Which metal installments accumulate as. Unset for DIWALI (fixed hamper, not gram-based). */
  metal?: SchemeMetal | null;
  planName: string;
  monthlyAmount: number;
  duration: number;
  bonusAmount: number;
  totalPaid: number;
  status: 'Active' | 'Completed' | 'Cancelled' | 'Dropped';
  payments: ISavingsPayment[];
  maturityBenefits?: IMaturityBenefits | null;
  cancellation?: ICancellation | null;
  startDate: Date;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ISchemeHamper {
  goldCoinPurity?: string | null;
  silverCoinGrams?: number | null;
  giftsValue?: number | null;
  gifts?: string[];
}

export interface ISchemePlan {
  _id: string;
  type: SchemeType;
  name: string;
  description?: string | null;
  isActive: boolean;
  metal?: SchemeMetal | null;
  durationMonths: number;
  bonusMonths: number;
  paymentMode: SchemePaymentMode;
  /** FIXED plans only — selectable fixed monthly amounts, stored in `scheme_plan_monthly_amounts`. */
  monthlyAmounts: number[];
  /** FLEXIBLE plans only — the admin-configurable floor a customer's self-chosen payment must
   * meet (item 4: "starts from ₹100, admin configurable"). */
  minPaymentAmount?: number | null;
  passbookPrefix: string;
  paymentDueDayOfMonth: number;
  earlyExitPenaltyPercent: number;
  maxConsecutiveMissedMonths?: number | null;
  redemptionMode: 'GOODS_ONLY' | 'CASH_ALLOWED';
  hamper?: ISchemeHamper | null;
  sortOrder: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}
