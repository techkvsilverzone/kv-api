import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISavingsPayment {
  month: number;
  amount: number;
  paidAt: Date;
}

export interface ISavings extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  passbookNumber: string;
  planName: string;
  monthlyAmount: number;
  duration: number;
  bonusAmount: number;
  totalPaid: number;
  status: 'Active' | 'Completed' | 'Cancelled';
  payments: ISavingsPayment[];
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SavingsPaymentSchema = new Schema<ISavingsPayment>(
  {
    month: { type: Number, required: true },
    amount: { type: Number, required: true },
    paidAt: { type: Date, default: Date.now },
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
    startDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

SavingsSchema.index({ userId: 1 });

export const Savings: Model<ISavings> = mongoose.model<ISavings>('Savings', SavingsSchema);
