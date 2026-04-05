import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPincodeRate extends Document {
  _id: mongoose.Types.ObjectId;
  pincode: string;
  label: string;
  rate: number;
  createdAt: Date;
  updatedAt: Date;
}

const PincodeRateSchema = new Schema<IPincodeRate>(
  {
    pincode: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    rate: { type: Number, required: true },
  },
  { timestamps: true },
);

export const PincodeRate: Model<IPincodeRate> = mongoose.model<IPincodeRate>('PincodeRate', PincodeRateSchema);
