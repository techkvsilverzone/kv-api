import mongoose, { Schema, Document, Model } from 'mongoose';

export type StaleMetal = 'silver' | 'gold';

/**
 * Authoritative daily price-update block flag (#25 B4). A single global document
 * the cron writes and `GET /admin/rate-status` reads, so the block is not solely
 * recomputed client-side.
 */
export interface IRateStatus extends Document {
  key: 'global';
  blocked: boolean;
  staleMetals: StaleMetal[];
  checkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RateStatusSchema = new Schema<IRateStatus>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    blocked: { type: Boolean, required: true, default: false },
    staleMetals: { type: [String], enum: ['silver', 'gold'], default: [] },
    checkedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

export const RateStatus: Model<IRateStatus> = mongoose.model<IRateStatus>(
  'RateStatus',
  RateStatusSchema,
);
