import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStoreConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  theme: string;
  isDark: boolean;
  updatedAt: Date;
}

const StoreConfigSchema = new Schema<IStoreConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    theme: { type: String, required: true, default: 'icy-silver', trim: true },
    isDark: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const StoreConfig: Model<IStoreConfig> = mongoose.model<IStoreConfig>('StoreConfig', StoreConfigSchema);