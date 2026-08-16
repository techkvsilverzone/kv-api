import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGiftVoucher extends Document {
  _id: mongoose.Types.ObjectId;
  label: string;
  amount: number;
  description?: string;
  imageBase64?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const GiftVoucherSchema = new Schema<IGiftVoucher>(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    description: { type: String, trim: true },
    imageBase64: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 1 },
  },
  { timestamps: true },
);

GiftVoucherSchema.index({ isActive: 1, sortOrder: 1 });

export const GiftVoucher: Model<IGiftVoucher> = mongoose.model<IGiftVoucher>(
  'GiftVoucher',
  GiftVoucherSchema,
);
