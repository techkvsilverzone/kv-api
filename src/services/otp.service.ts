import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { OtpCodeRepository } from '../repositories/otpCode.repository';
import { config } from '../config';
import { AppError } from '../utils/appError';
import { sendOtpEmail, sendPasswordResetEmail, sendPhoneVerificationEmail, sendEnrollmentConfirmationEmail } from '../utils/emailNotifications';
import { sendOtpWhatsApp, WhatsAppSendResult } from '../utils/whatsapp';
import { generateToken } from '../utils/jwt';
import { toUserResponse } from '../utils/userResponse';
import Logger from '../utils/logger';
import { toIndianMobile } from '../utils/phone';
import { recordMessage } from '../utils/messageLog';

const PURPOSE = 'login';

// Reset codes are scoped to their own purpose so a code issued for one flow can
// never be redeemed in the other (a login code must not reset a password).
const RESET_PURPOSE = 'password_reset';
// Item 1 (mobile OTP): scoped to its own purpose, same reasoning as RESET_PURPOSE — a code
// issued to verify a phone must not be redeemable as a login/reset code and vice versa.
const PHONE_VERIFY_PURPOSE = 'phone_verify';
// Item 2 (replaced 2026-09-16, was KYC-gated): scoped to its own purpose too — a code issued to
// confirm one enrollment attempt must not be redeemable for login/reset/phone-verify or vice
// versa. Unlike PHONE_VERIFY_PURPOSE this is never "already done" — a fresh code is sent (and
// must be confirmed) on every enrollment attempt, not just once per customer.
const ENROLL_CONFIRM_PURPOSE = 'enroll_confirm';
const MIN_PASSWORD_LENGTH = 6;

/** Generates a 6-digit numeric code using a CSPRNG (not Math.random). */
function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// sendWhatsAppText never throws — a failed send comes back as `{ sent: false }`, so it must be logged here.
function logWhatsAppOtpResult(purpose: string, phone: string, result: WhatsAppSendResult): void {
  if (result.sent) {
    Logger.info(`[otp] ${purpose} OTP accepted by WhatsApp for ${phone} — message id ${result.messageId ?? 'n/a'}`);
  } else {
    Logger.error(`[otp] ${purpose} OTP NOT sent via WhatsApp to ${phone}: ${result.skippedReason}`);
  }
}

/** Sends an OTP email and records the outcome in message_log (the code itself is never stored). */
async function sendLoggedOtpEmail(purpose: string, email: string, send: () => Promise<unknown>): Promise<void> {
  try {
    await send();
  } catch (error) {
    await recordMessage({ channel: 'email', kind: `otp_${purpose}`, recipient: email, status: 'failed', error: String(error) });
    throw error;
  }
  await recordMessage({ channel: 'email', kind: `otp_${purpose}`, recipient: email, status: 'sent' });
}

export class OtpService {
  private userRepository: UserRepository;
  private otpCodeRepository: OtpCodeRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.otpCodeRepository = new OtpCodeRepository();
  }

  /**
   * Issue a login OTP for the given MOBILE NUMBER (primary login method, replacing
   * email-based OTP login 2026-09-16 — password+email login is still available as the
   * secondary method). Always returns a generic success message — whether or not the
   * phone is registered — so this endpoint can't be used to enumerate accounts; the
   * code itself is only ever sent if a matching, active account exists, and the
   * response never reveals which channel it went out on (that alone would leak
   * registration status). WhatsApp-first with an email fallback while WhatsApp OTP is
   * disabled/pending Meta's Authentication-template approval — same channel pattern as
   * `requestPhoneVerification`/`requestEnrollmentOtp`, since the customer proved a
   * phone number here, not an email.
   */
  public async requestLoginOtp(phone: string): Promise<{ message: string }> {
    const normalized = toIndianMobile(phone);
    if (!normalized) {
      throw new AppError('phone is required', 400);
    }

    const user = await this.userRepository.findByPhone(normalized);
    const generic = { message: 'If that mobile number is registered, a login code has been sent.' };
    if (!user) {
      Logger.warn(`[otp] login OTP requested for unregistered phone ${normalized} — nothing sent`);
      return generic;
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60_000);
    await this.otpCodeRepository.create(normalized, PURPOSE, codeHash, expiresAt);
    Logger.info(`[otp] login OTP issued for user ${user._id} via ${config.whatsappOtpEnabled ? 'whatsapp' : 'email'}`);

    if (config.whatsappOtpEnabled) {
      try {
        const result = await sendOtpWhatsApp(normalized, code, PURPOSE);
        logWhatsAppOtpResult('login', normalized, result);
      } catch (error) {
        Logger.error(`Login OTP WhatsApp dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new AppError('Failed to send login code. Please try again.', 500);
      }
      return generic;
    }

    try {
      await sendLoggedOtpEmail(PURPOSE, user.email, () =>
        sendOtpEmail({ email: user.email, name: user.name, code, expiryMinutes: config.otpExpiryMinutes }),
      );
    } catch (error) {
      Logger.error(`Login OTP email dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError('Failed to send login code. Please try again.', 500);
    }
    return generic;
  }

  /** Verify a login OTP (by mobile number) and issue a session, exactly like password login. */
  public async verifyLoginOtp(phone: string, code: string): Promise<{ user: unknown; token: string }> {
    const normalized = toIndianMobile(phone);
    if (!normalized || !code) {
      throw new AppError('phone and code are required', 400);
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

    const user = await this.userRepository.findByPhone(normalized);
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
      await sendLoggedOtpEmail(RESET_PURPOSE, normalized, () =>
        sendPasswordResetEmail({ email: normalized, name: user.name, code, expiryMinutes: config.otpExpiryMinutes }),
      );
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
      logWhatsAppOtpResult('phone_verify', phone, await sendOtpWhatsApp(phone, code, PHONE_VERIFY_PURPOSE));
      return { message: 'A verification code has been sent to your WhatsApp.', channel: 'whatsapp' };
    }

    try {
      await sendLoggedOtpEmail(PHONE_VERIFY_PURPOSE, user.email, () =>
        sendPhoneVerificationEmail({ email: user.email, name: user.name, code, expiryMinutes: config.otpExpiryMinutes }),
      );
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

  /**
   * Item 2 (replaced 2026-09-16, was KYC-gated): issue a fresh confirmation code for the
   * calling user's own phone, to be entered right before a savings-scheme enrollment goes
   * through (see `SavingsService.enroll`). Same WhatsApp-first/email-fallback channel as
   * `requestPhoneVerification`, but never "already done" — sent again on every attempt.
   */
  public async requestEnrollmentOtp(userId: string): Promise<{ message: string; channel: 'whatsapp' | 'email' }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('Account not found', 404);
    }
    const phone = String(user.phone || '').trim();
    if (!phone) {
      throw new AppError('Add a phone number to your account before enrolling in a savings scheme', 400);
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60_000);
    await this.otpCodeRepository.create(phone, ENROLL_CONFIRM_PURPOSE, codeHash, expiresAt);

    if (config.whatsappOtpEnabled) {
      logWhatsAppOtpResult('enroll_confirm', phone, await sendOtpWhatsApp(phone, code, ENROLL_CONFIRM_PURPOSE));
      return { message: 'A confirmation code has been sent to your WhatsApp.', channel: 'whatsapp' };
    }

    try {
      await sendLoggedOtpEmail(ENROLL_CONFIRM_PURPOSE, user.email, () =>
        sendEnrollmentConfirmationEmail({ email: user.email, name: user.name, code, expiryMinutes: config.otpExpiryMinutes }),
      );
    } catch (error) {
      Logger.error(`Enrollment confirmation email dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError('Failed to send confirmation code. Please try again.', 500);
    }
    return { message: 'WhatsApp confirmation is not yet active, so we emailed your code instead.', channel: 'email' };
  }

  /** Verify (and consume) the code from `requestEnrollmentOtp`. Called from inside
   * `SavingsService.enroll` — a thrown AppError here becomes the enrollment's own error. */
  public async verifyEnrollmentOtp(userId: string, code: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('Account not found', 404);
    }
    const phone = String(user.phone || '').trim();
    if (!phone || !code) {
      throw new AppError('Enter the confirmation code sent to your phone before enrolling', 400);
    }

    const otp = await this.otpCodeRepository.findActive(phone, ENROLL_CONFIRM_PURPOSE);
    if (!otp) {
      throw new AppError('Invalid or expired confirmation code. Please request a new one.', 400);
    }

    const matches = await bcrypt.compare(String(code).trim(), otp.codeHash);
    if (!matches) {
      await this.otpCodeRepository.incrementAttempts(otp._id.toString());
      throw new AppError('Incorrect confirmation code.', 400);
    }

    await this.otpCodeRepository.markConsumed(otp._id.toString());
  }
}
