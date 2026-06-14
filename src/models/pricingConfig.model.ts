import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPricingConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  gstPercent: number;
  updatedAt: Date;
}

const PricingConfigSchema = new Schema<IPricingConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    gstPercent: { type: Number, required: true, default: 3, min: 0, max: 100 },
  },
  { timestamps: true },
);

export const PricingConfig: Model<IPricingConfig> = mongoose.model<IPricingConfig>(
  'PricingConfig',
  PricingConfigSchema,
);
