import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * An unboxing video received on the returns WhatsApp number that couldn't be
 * auto-matched to a return request (no/garbled reference code in the caption,
 * and either no or multiple returns awaiting video from that phone number).
 * Surfaced in the admin Returns tab for manual linking.
 */
export interface IUnmatchedReturnVideo extends Document {
  _id: mongoose.Types.ObjectId;
  senderPhone: string;
  filePath: string;
  mimeType: string;
  caption?: string;
  linkedReturnId?: mongoose.Types.ObjectId;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UnmatchedReturnVideoSchema = new Schema<IUnmatchedReturnVideo>(
  {
    senderPhone: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    caption: { type: String },
    linkedReturnId: { type: Schema.Types.ObjectId, ref: 'Return' },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

export const UnmatchedReturnVideo: Model<IUnmatchedReturnVideo> = mongoose.model<IUnmatchedReturnVideo>(
  'UnmatchedReturnVideo',
  UnmatchedReturnVideoSchema,
);
