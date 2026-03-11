import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISilverRate extends Document {
  _id: mongoose.Types.ObjectId;
  rateDate: Date;
  purity: '999' | '925' | '916';
  ratePerGram: number;
  ratePerKg: number;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SilverRateSchema = new Schema<ISilverRate>(
  {
    rateDate: { type: Date, required: true },
    purity: { type: String, required: true, enum: ['999', '925', '916'] },
    ratePerGram: { type: Number, required: true },
    ratePerKg: { type: Number, required: true },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

SilverRateSchema.index({ rateDate: 1, purity: 1 }, { unique: true });
SilverRateSchema.index({ rateDate: -1 });

export const SilverRate: Model<ISilverRate> = mongoose.model<ISilverRate>(
  'SilverRate',
  SilverRateSchema,
);
