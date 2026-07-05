import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDeliveryConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  chennai: number;
  otherDistrict: number;
  otherState: number;
  updatedAt: Date;
}

const DeliveryConfigSchema = new Schema<IDeliveryConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    chennai: { type: Number, required: true, default: 150, min: 0 },
    otherDistrict: { type: Number, required: true, default: 200, min: 0 },
    otherState: { type: Number, required: true, default: 250, min: 0 },
  },
  { timestamps: true },
);

export const DeliveryConfig: Model<IDeliveryConfig> = mongoose.model<IDeliveryConfig>(
  'DeliveryConfig',
  DeliveryConfigSchema,
);
