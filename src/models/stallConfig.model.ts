import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStallConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  active: boolean;
  updatedAt: Date;
}

const StallConfigSchema = new Schema<IStallConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    active: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

export const StallConfig: Model<IStallConfig> = mongoose.model<IStallConfig>(
  'StallConfig',
  StallConfigSchema,
);
