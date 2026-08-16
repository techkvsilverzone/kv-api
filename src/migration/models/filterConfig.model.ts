import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPriceRange {
  label: string;
  value: string;
}

export interface IFilterConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  hiddenCategories: string[];
  metals: string[];
  priceRanges: IPriceRange[];
  updatedAt: Date;
}

const PriceRangeSchema = new Schema<IPriceRange>(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const FilterConfigSchema = new Schema<IFilterConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    hiddenCategories: { type: [String], default: [] },
    metals: { type: [String], default: [] },
    priceRanges: { type: [PriceRangeSchema], default: [] },
  },
  { timestamps: true },
);

export const FilterConfig: Model<IFilterConfig> = mongoose.model<IFilterConfig>('FilterConfig', FilterConfigSchema);
