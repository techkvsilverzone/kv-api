import { UserRepository } from '../repositories/user.repository';
import { CouponRepository } from '../repositories/coupon.repository';
import { AppError } from '../utils/appError';
import { generateToken } from '../utils/jwt';
import bcrypt from 'bcryptjs';

function computeRole(user: { isAdmin: boolean; role?: string }): 'admin' | 'staff' | 'customer' {
  if (user.role === 'staff') return 'staff';
  if (user.role === 'admin' || user.isAdmin) return 'admin';
  return 'customer';
}

export class UserService {
  private userRepository: UserRepository;
  private couponRepository: CouponRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.couponRepository = new CouponRepository();
  }

  public async signup(data: any) {
    if (!data?.password) {
      throw new AppError('Password is required', 400);
    }

    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }

    const user = await this.userRepository.create({
      ...data,
      isStallRegistration: data.stallEvent === true,
    });
    const token = generateToken(user._id.toString());
    const { passwordHash, ...safeUser } = user.toObject ? user.toObject() : (user as any);

    let promoCoupon: string | undefined;
    if (data.stallEvent === true) {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 3);
      const code = `STALL${user._id.toString().slice(-6).toUpperCase()}`;
      const coupon = await this.couponRepository.create({
        code,
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: 0,
        maxUses: 1,
        expiryDate,
        isActive: true,
      });
      promoCoupon = coupon.code;
    }

    return { user: { ...safeUser, role: computeRole(safeUser) }, token, ...(promoCoupon ? { promoCoupon } : {}) };
  }

  public async login(data: any) {
    const { email, password } = data;
    const user = await this.userRepository.findByEmail(email);

    const isPasswordValid =
      !!user?.passwordHash && !!password && (await bcrypt.compare(password, user.passwordHash));

    if (!user || !isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken(user._id.toString());
    const { passwordHash, ...safeUser } = user.toObject ? user.toObject() : (user as any);
    return { user: { ...safeUser, role: computeRole(safeUser) }, token };
  }

  public async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    const { passwordHash, ...safeUser } = user.toObject ? user.toObject() : (user as any);
    return { ...safeUser, role: computeRole(safeUser) };
  }

  public async updateProfile(userId: string, data: any) {
    const user = await this.userRepository.update(userId, data);
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  public async getAllUsers() {
    return await this.userRepository.findAll();
  }
}
