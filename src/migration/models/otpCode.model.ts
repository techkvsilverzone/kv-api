import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOtpCode extends Document {
  _id: mongoose.Types.ObjectId;
  identifier: string;
  purpose: string;
  codeHash: string;
  attempts: number;
  consumed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const OtpCodeSchema = new Schema<IOtpCode>(
  {
    identifier: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, required: true, default: 'login' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index — Mongo auto-deletes the document once it's past expiresAt.
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpCode: Model<IOtpCode> = mongoose.model<IOtpCode>('OtpCode', OtpCodeSchema);
