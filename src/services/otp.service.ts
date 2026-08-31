import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { OtpCodeRepository } from '../repositories/otpCode.repository';
import { config } from '../config';
import { AppError } from '../utils/appError';
import { sendOtpEmail, sendPasswordResetEmail, sendPhoneVerificationEmail } from '../utils/emailNotifications';
import { sendOtpWhatsApp, sendPhoneVerificationWhatsApp } from '../utils/whatsapp';
import { generateToken } from '../utils/jwt';
import { toUserResponse } from '../utils/userResponse';
import Logger from '../utils/logger';

const PURPOSE = 'login';

// Reset codes are scoped to their own purpose so a code issued for one flow can
// never be redeemed in the other (a login code must not reset a password).
const RESET_PURPOSE = 'password_reset';
// Item 1 (mobile OTP): scoped to its own purpose, same reasoning as RESET_PURPOSE — a code
// issued to verify a phone must not be redeemable as a login/reset code and vice versa.
const PHONE_VERIFY_PURPOSE = 'phone_verify';
const MIN_PASSWORD_LENGTH = 6;

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
    return { user: toUserResponse(user), token };
  }

  /**
   * Issue a password-reset code. Like `requestLoginOtp`, the response is generic
   * regardless of whether the email is registered, so this can't be used to
   * enumerate accounts.
   */
  public async requestPasswordReset(email: string): Promise<{ message: string }> {
    const normalized = String(email || '').toLowerCase().trim();
    if (!normalized) {
      throw new AppError('email is required', 400);
    }

    const user = await this.userRepository.findByEmail(normalized);
    const generic = { message: 'If that email is registered, a password reset code has been sent.' };
    if (!user) return generic;

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60_000);
    await this.otpCodeRepository.create(normalized, RESET_PURPOSE, codeHash, expiresAt);

    try {
      await sendPasswordResetEmail({
        email: normalized,
        name: user.name,
        code,
        expiryMinutes: config.otpExpiryMinutes,
      });
    } catch (error) {
      Logger.error(
        `Password reset email dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new AppError('Failed to send reset code. Please try again.', 500);
    }

    return generic;
  }

  /** Redeem a password-reset code and set the new password. */
  public async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const normalized = String(email || '').toLowerCase().trim();
    if (!normalized || !code) {
      throw new AppError('email and code are required', 400);
    }
    if (
      !newPassword ||
      typeof newPassword !== 'string' ||
      newPassword.trim().length < MIN_PASSWORD_LENGTH
    ) {
      throw new AppError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
    }

    const otp = await this.otpCodeRepository.findActive(normalized, RESET_PURPOSE);
    if (!otp) {
      throw new AppError('Invalid or expired code. Please request a new one.', 400);
    }

    const matches = await bcrypt.compare(String(code).trim(), otp.codeHash);
    if (!matches) {
      await this.otpCodeRepository.incrementAttempts(otp._id.toString());
      throw new AppError('Incorrect code.', 400);
    }

    const user = await this.userRepository.findByEmail(normalized);
    if (!user) {
      throw new AppError('Account no longer exists.', 404);
    }

    // Consume only once the password actually lands, so a write failure leaves the
    // code usable for a retry instead of burning it.
    await this.userRepository.update(user._id.toString(), { password: newPassword.trim() });
    await this.otpCodeRepository.markConsumed(otp._id.toString());

    return { message: 'Password updated successfully. Please sign in with your new password.' };
  }

  /**
   * Item 1: issue a mobile-verification code for the CALLING user's own phone number (the
   * identifier is the phone number itself, not the user id, so the code is scoped to the exact
   * number being proven — matches how login/reset codes are scoped to an email). Prefers
   * WhatsApp (reuses the login-OTP channel/config); falls back to email while WhatsApp OTP is
   * disabled/pending Meta's Authentication-template approval, so phone verification isn't
   * blocked on that external approval.
   */
  public async requestPhoneVerification(userId: string): Promise<{ message: string; channel: 'whatsapp' | 'email' }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('Account not found', 404);
    }
    const phone = String(user.phone || '').trim();
    if (!phone) {
      throw new AppError('Add a phone number to your account before verifying it', 400);
    }
    if (user.phoneVerified) {
      throw new AppError('This phone number is already verified', 400);
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60_000);
    await this.otpCodeRepository.create(phone, PHONE_VERIFY_PURPOSE, codeHash, expiresAt);

    if (config.whatsappOtpEnabled) {
      await sendPhoneVerificationWhatsApp(phone, code, config.otpExpiryMinutes);
      return { message: 'A verification code has been sent to your WhatsApp.', channel: 'whatsapp' };
    }

    try {
      await sendPhoneVerificationEmail({
        email: user.email,
        name: user.name,
        code,
        expiryMinutes: config.otpExpiryMinutes,
      });
    } catch (error) {
      Logger.error(`Phone verification email dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError('Failed to send verification code. Please try again.', 500);
    }
    return { message: 'WhatsApp verification is not yet active, so we emailed your code instead.', channel: 'email' };
  }

  /** Verify the code issued by `requestPhoneVerification` and mark the phone verified. */
  public async verifyPhoneOtp(userId: string, code: string): Promise<{ user: unknown }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('Account not found', 404);
    }
    const phone = String(user.phone || '').trim();
    if (!phone || !code) {
      throw new AppError('phone and code are required', 400);
    }

    const otp = await this.otpCodeRepository.findActive(phone, PHONE_VERIFY_PURPOSE);
    if (!otp) {
      throw new AppError('Invalid or expired code. Please request a new one.', 400);
    }

    const matches = await bcrypt.compare(String(code).trim(), otp.codeHash);
    if (!matches) {
      await this.otpCodeRepository.incrementAttempts(otp._id.toString());
      throw new AppError('Incorrect code.', 400);
    }

    await this.otpCodeRepository.markConsumed(otp._id.toString());
    const updated = await this.userRepository.update(userId, { phoneVerified: true });
    return { user: toUserResponse(updated) };
  }
}
