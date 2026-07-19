import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvoiceConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  companyName: string;
  gstin: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  updatedAt: Date;
}

const InvoiceConfigSchema = new Schema<IInvoiceConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    companyName: { type: String, default: 'KV Silver Zone', trim: true },
    gstin: { type: String, default: '', trim: true },
    companyAddress: { type: String, default: '', trim: true },
    companyPhone: { type: String, default: '', trim: true },
    companyEmail: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

export const InvoiceConfig: Model<IInvoiceConfig> = mongoose.model<IInvoiceConfig>(
  'InvoiceConfig',
  InvoiceConfigSchema,
);
