import mongoose, { Schema, Document, Model } from 'mongoose';

export type MetalType = 'SILVER' | 'GOLD';

export interface IMetalRate extends Document {
  _id: mongoose.Types.ObjectId;
  date: Date;
  metal: MetalType;
  karat: number | null;
  ratePerGram: number;
  ratePerKg: number;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MetalRateSchema = new Schema<IMetalRate>(
  {
    date: { type: Date, required: true },
    metal: { type: String, required: true, enum: ['SILVER', 'GOLD'] },
    karat: { type: Number, default: null },
    ratePerGram: { type: Number, required: true },
    ratePerKg: { type: Number, required: true },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

MetalRateSchema.index({ date: 1, metal: 1, karat: 1 }, { unique: true });
MetalRateSchema.index({ date: -1, metal: 1, karat: 1 });

export const MetalRate: Model<IMetalRate> = mongoose.model<IMetalRate>(
  'MetalRate',
  MetalRateSchema,
);
