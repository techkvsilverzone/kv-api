import { UserRepository, AddressData } from '../repositories/user.repository';
import { IAddress } from '../models/user.model';
import { CouponRepository } from '../repositories/coupon.repository';
import { StallConfigRepository } from '../repositories/stallConfig.repository';
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
  private stallConfigRepository: StallConfigRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.couponRepository = new CouponRepository();
    this.stallConfigRepository = new StallConfigRepository();
  }

  public async signup(data: any) {
    if (!data?.password) {
      throw new AppError('Password is required', 400);
    }

    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }

    // Offline-stall registration is server-gated: even if a client claims
    // stallEvent=true, it's only honoured while the admin toggle is active.
    const stallConfig = await this.stallConfigRepository.getConfig();
    const stallEventHonoured = stallConfig.active && data.stallEvent === true;

    const user = await this.userRepository.create({
      ...data,
      isStallRegistration: stallEventHonoured,
    });
    const token = generateToken(user._id.toString());
    const { passwordHash, ...safeUser } = user.toObject ? user.toObject() : (user as any);

    let promoCoupon: string | undefined;
    if (stallEventHonoured) {
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

  // ── Address book ─────────────────────────────────────────────────────

  private toAddressResponse(a: IAddress) {
    return {
      id: a._id.toString(),
      label: a.label,
      firstName: a.firstName,
      lastName: a.lastName,
      address: a.address,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      phone: a.phone,
      isDefault: a.isDefault,
    };
  }

  private buildAddressData(data: any, partial: boolean): AddressData {
    const required = ['firstName', 'lastName', 'address', 'city', 'state', 'pincode', 'phone'];
    for (const field of required) {
      const provided = data[field] !== undefined;
      if (partial && !provided) continue;
      if (!provided || !String(data[field]).trim()) {
        throw new AppError(`${field} is required`, 400);
      }
    }
    if (data.pincode !== undefined && !/^\d{6}$/.test(String(data.pincode).trim())) {
      throw new AppError('pincode must be a 6-digit number', 400);
    }
    if (data.phone !== undefined && !/^[6-9]\d{9}$/.test(String(data.phone).trim())) {
      throw new AppError('phone must be a valid 10-digit Indian mobile number', 400);
    }

    const out: any = {};
    for (const field of [...required, 'label']) {
      if (data[field] !== undefined) out[field] = String(data[field]).trim();
    }
    if (data.isDefault !== undefined) out.isDefault = Boolean(data.isDefault);
    return out as AddressData;
  }

  public async getAddresses(userId: string) {
    const addresses = await this.userRepository.getAddresses(userId);
    return addresses.map((a) => this.toAddressResponse(a));
  }

  public async addAddress(userId: string, data: any) {
    const payload = this.buildAddressData(data, false);
    const address = await this.userRepository.addAddress(userId, payload);
    if (!address) throw new AppError('User not found', 404);
    return this.toAddressResponse(address);
  }

  public async updateAddress(userId: string, addressId: string, data: any) {
    const payload = this.buildAddressData(data, true);
    if (Object.keys(payload).length === 0) {
      throw new AppError('No valid fields provided for update', 400);
    }
    const address = await this.userRepository.updateAddress(userId, addressId, payload);
    if (!address) throw new AppError('Address not found', 404);
    return this.toAddressResponse(address);
  }

  public async deleteAddress(userId: string, addressId: string) {
    const deleted = await this.userRepository.deleteAddress(userId, addressId);
    if (!deleted) throw new AppError('Address not found', 404);
  }

  public async changePassword(requesterUserId: string, targetUserId: string, newPassword: string) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      throw new AppError('New password must be at least 6 characters', 400);
    }

    const requester = await this.userRepository.findById(requesterUserId);
    if (!requester) {
      throw new AppError('Requesting user not found', 401);
    }

    const canChange = requester._id.toString() === targetUserId || requester.isAdmin;
    if (!canChange) {
      throw new AppError('You are not allowed to change this user password', 403);
    }

    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new AppError('Target user not found', 404);
    }

    await this.userRepository.update(targetUserId, { password: newPassword.trim() });
    return { message: 'Password updated successfully' };
  }
}
