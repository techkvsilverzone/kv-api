import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISavingsPayment {
  month: number;
  /** Cash actually collected this row. 0 on the auto-credited bonus/devident row. */
  amount: number;
  paidAt: Date;
  /** ₹/gram used to convert `amount` into silver — 0 on the bonus row (no real collection). */
  materialRate: number;
  /** `amount / materialRate`, rounded to 3dp — 0 on the bonus row. */
  materialWeight: number;
  /** Dividend/bonus ₹ credited on this row, if any. 0 on ordinary collection rows. */
  devidentAmount: number;
  /** ₹/gram used to convert `devidentAmount` into silver. 0 when there's no devident. */
  devidentMaterialRate: number;
  /** `devidentAmount / devidentMaterialRate`, rounded to 3dp. 0 when there's no devident. */
  devidentMaterialWeight: number;
}

export interface IMaturityBenefits {
  /** ₹ value of the gold coin awarded at scheme maturity. */
  goldCoinValue?: number;
  /** Grams of silver coin/article awarded at scheme maturity. */
  silverGrams?: number;
  /** Free-text extras, e.g. ["Crackers Box", "Sweets and Snacks", "Soubhagya Gift equivalent to Scheme Amount"]. */
  gifts?: string[];
}

export interface ISavings extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Unset until the scheme's first payment lands — see SavingsRepository.recordPayment. */
  passbookNumber?: string;
  planName: string;
  monthlyAmount: number;
  duration: number;
  bonusAmount: number;
  totalPaid: number;
  status: 'Active' | 'Completed' | 'Cancelled';
  payments: ISavingsPayment[];
  /** Admin-configurable reward shown on the passbook once the scheme matures. */
  maturityBenefits?: IMaturityBenefits;
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
  },
  { _id: false },
);

const MaturityBenefitsSchema = new Schema<IMaturityBenefits>(
  {
    goldCoinValue: { type: Number },
    silverGrams: { type: Number },
    gifts: { type: [String], default: [] },
  },
  { _id: false },
);

const SavingsSchema = new Schema<ISavings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    passbookNumber: { type: String, unique: true, sparse: true },
    planName: { type: String, required: true },
    monthlyAmount: { type: Number, required: true },
    duration: { type: Number, required: true },
    bonusAmount: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ['Active', 'Completed', 'Cancelled'],
      default: 'Active',
    },
    payments: { type: [SavingsPaymentSchema], default: [] },
    maturityBenefits: { type: MaturityBenefitsSchema },
    startDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

SavingsSchema.index({ userId: 1 });

export const Savings: Model<ISavings> = mongoose.model<ISavings>('Savings', SavingsSchema);
