import { OtpCode, IOtpCode } from '../models/otpCode.model';

const MAX_ATTEMPTS = 5;

export class OtpCodeRepository {
  public async create(identifier: string, purpose: string, codeHash: string, expiresAt: Date): Promise<IOtpCode> {
    const otp = new OtpCode({ identifier: identifier.toLowerCase().trim(), purpose, codeHash, expiresAt });
    return otp.save();
  }

  /** The most recent unconsumed, unexpired, not-yet-locked-out code for this identifier+purpose. */
  public async findActive(identifier: string, purpose: string): Promise<IOtpCode | null> {
    return OtpCode.findOne({
      identifier: identifier.toLowerCase().trim(),
      purpose,
      consumed: false,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_ATTEMPTS },
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async incrementAttempts(id: string): Promise<void> {
    await OtpCode.findByIdAndUpdate(id, { $inc: { attempts: 1 } }).exec();
  }

  public async markConsumed(id: string): Promise<void> {
    await OtpCode.findByIdAndUpdate(id, { $set: { consumed: true } }).exec();
  }
}
