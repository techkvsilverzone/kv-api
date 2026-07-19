import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { OtpCodeRepository } from '../repositories/otpCode.repository';
import { config } from '../config';
import { AppError } from '../utils/appError';
import { sendOtpEmail } from '../utils/emailNotifications';
import { sendOtpWhatsApp } from '../utils/whatsapp';
import { generateToken } from '../utils/jwt';
import Logger from '../utils/logger';

const PURPOSE = 'login';

function computeRole(user: { isAdmin: boolean; role?: string }): 'admin' | 'staff' | 'customer' {
  if (user.role === 'staff') return 'staff';
  if (user.role === 'admin' || user.isAdmin) return 'admin';
  return 'customer';
}

/** Generates a 6-digit numeric code using a CSPRNG (not Math.random). */
function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export class OtpService {
  private userRepository: UserRepository;
  private otpCodeRepository: OtpCodeRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.otpCodeRepository = new OtpCodeRepository();
  }

  /**
   * Issue a login OTP for the given email. Always returns a generic success
   * message — whether or not the email is registered — so this endpoint can't
   * be used to enumerate accounts. The code itself is only ever sent if a
   * matching, active account exists.
   */
  public async requestLoginOtp(email: string): Promise<{ message: string }> {
    const normalized = String(email || '').toLowerCase().trim();
    if (!normalized) {
      throw new AppError('email is required', 400);
    }

    const user = await this.userRepository.findByEmail(normalized);
    const generic = { message: 'If that email is registered, a login code has been sent.' };
    if (!user) return generic;

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60_000);
    await this.otpCodeRepository.create(normalized, PURPOSE, codeHash, expiresAt);

    try {
      await sendOtpEmail({ email: normalized, name: user.name, code, expiryMinutes: config.otpExpiryMinutes });
    } catch (error) {
      Logger.error(`OTP email dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError('Failed to send login code. Please try again.', 500);
    }

    // WhatsApp is an additional channel, gated behind approval — never lets a
    // delivery failure there block the (working) email channel above.
    if (config.whatsappOtpEnabled && user.phone) {
      sendOtpWhatsApp(user.phone, code, config.otpExpiryMinutes).catch((error: unknown) =>
        Logger.error(`OTP WhatsApp dispatch failed: ${String(error)}`),
      );
    }

    return generic;
  }

  /** Verify a login OTP and issue a session, exactly like password login. */
  public async verifyLoginOtp(email: string, code: string): Promise<{ user: unknown; token: string }> {
    const normalized = String(email || '').toLowerCase().trim();
    if (!normalized || !code) {
      throw new AppError('email and code are required', 400);
    }

    const otp = await this.otpCodeRepository.findActive(normalized, PURPOSE);
    if (!otp) {
      throw new AppError('Invalid or expired code. Please request a new one.', 400);
    }

    const matches = await bcrypt.compare(String(code).trim(), otp.codeHash);
    if (!matches) {
      await this.otpCodeRepository.incrementAttempts(otp._id.toString());
      throw new AppError('Incorrect code.', 400);
    }

    await this.otpCodeRepository.markConsumed(otp._id.toString());

    const user = await this.userRepository.findByEmail(normalized);
    if (!user) {
      throw new AppError('Account no longer exists.', 404);
    }

    const token = generateToken(user._id.toString());
    const { passwordHash, ...safeUser } = user.toObject ? user.toObject() : (user as any);
    return { user: { ...safeUser, role: computeRole(safeUser) }, token };
  }
}
