import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/user.model';

export { IUser };

export interface IUserWithPassword extends IUser {
  passwordHash: string;
}

export class UserRepository {
  public async create(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<IUser> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = new User({
      name: data.name,
      email: data.email,
      passwordHash,
      phone: data.phone,
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
}
