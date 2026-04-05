import mongoose, { Schema, Document, Model } from 'mongoose';

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true },
);

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
