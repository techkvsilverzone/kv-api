import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAddress {
  _id: mongoose.Types.ObjectId;
  label?: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  isAdmin: boolean;
  isActive: boolean;
  role?: 'admin' | 'staff' | 'customer';
  isStallRegistration?: boolean;
  /** Used for the daily WhatsApp birthday-wish cron (year is ignored — only month/day matter). */
  dateOfBirth?: Date;
  /** Used for the daily WhatsApp wedding-anniversary-wish cron. */
  anniversaryDate?: Date;
  addresses: mongoose.Types.DocumentArray<IAddress>;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    label: { type: String, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    role: { type: String, enum: ['admin', 'staff', 'customer'] },
    isStallRegistration: { type: Boolean, default: false },
    dateOfBirth: { type: Date },
    anniversaryDate: { type: Date },
    addresses: { type: [AddressSchema], default: [] },
  },
  { timestamps: true },
);

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
