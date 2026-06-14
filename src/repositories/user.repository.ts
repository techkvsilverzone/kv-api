import bcrypt from 'bcryptjs';
import { User, IUser, IAddress } from '../models/user.model';

export { IUser, IAddress };

export interface AddressData {
  label?: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault?: boolean;
}

export interface IUserWithPassword extends IUser {
  passwordHash: string;
}

export class UserRepository {
  public async create(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    isStallRegistration?: boolean;
  }): Promise<IUser> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = new User({
      name: data.name,
      email: data.email,
      passwordHash,
      phone: data.phone,
      isStallRegistration: data.isStallRegistration ?? false,
    });
    return user.save();
  }

  public async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase().trim(), isActive: true }).exec();
  }

  public async findById(id: string): Promise<IUser | null> {
    return User.findById(id).exec();
  }

  public async update(id: string, data: Partial<IUser & { password?: string }>): Promise<IUser | null> {
    if (data.email) {
      const existing = await User.findOne({ email: data.email.toLowerCase(), _id: { $ne: id } });
      if (existing) throw new Error('Email already in use');
    }

    const updateData: any = { ...data };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }

    return User.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  public async findAll(): Promise<IUser[]> {
    return User.find({ isActive: true }).sort({ createdAt: -1 }).exec();
  }

  public async findRegularCustomers(): Promise<IUser[]> {
    return User.find({ isActive: true, isAdmin: false }).sort({ createdAt: -1 }).exec();
  }

  // ── Address book ─────────────────────────────────────────────────────

  public async getAddresses(userId: string): Promise<IAddress[]> {
    const user = await User.findById(userId).exec();
    return user ? Array.from(user.addresses) : [];
  }

  public async addAddress(userId: string, data: AddressData): Promise<IAddress | null> {
    const user = await User.findById(userId).exec();
    if (!user) return null;

    // First address is always default; an explicit default unsets the others.
    const makeDefault = data.isDefault === true || user.addresses.length === 0;
    if (makeDefault) user.addresses.forEach((a) => (a.isDefault = false));

    user.addresses.push({ ...data, isDefault: makeDefault } as IAddress);
    await user.save();
    return user.addresses[user.addresses.length - 1];
  }

  public async updateAddress(
    userId: string,
    addressId: string,
    data: Partial<AddressData>,
  ): Promise<IAddress | null> {
    const user = await User.findById(userId).exec();
    if (!user) return null;

    const address = user.addresses.id(addressId);
    if (!address) return null;

    if (data.isDefault === true) {
      user.addresses.forEach((a) => (a.isDefault = false));
    }
    Object.assign(address, data);
    await user.save();
    return address;
  }

  public async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const user = await User.findById(userId).exec();
    if (!user) return false;

    const address = user.addresses.id(addressId);
    if (!address) return false;

    const wasDefault = address.isDefault;
    address.deleteOne();

    // Promote a remaining address to default if we removed the default one.
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    await user.save();
    return true;
  }
}
