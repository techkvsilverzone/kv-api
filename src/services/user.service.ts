import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/appError';
import { generateToken } from '../utils/jwt';
import bcrypt from 'bcryptjs';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  public async signup(data: any) {
    if (!data?.password) {
      throw new AppError('Password is required', 400);
    }

    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }

    const user = await this.userRepository.create(data);
    const token = generateToken(user._id.toString());
    return { user, token };
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
    const { passwordHash, ...safeUser } = user as any;
    return { user: safeUser, token };
  }

  public async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    return user;
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
