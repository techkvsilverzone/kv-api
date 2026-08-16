import { IOtpCode } from '../domain/otp';
import { query, queryOne } from '../infrastructure/postgres/pool';
import { toBigIntParam, toBool, toDate, toNum } from '../infrastructure/postgres/mapping';

const MAX_ATTEMPTS = 5;

/**
 * How long a spent code is kept before the opportunistic sweep in `create`
 * removes it. MongoDB expired these through a TTL index on `expiresAt`;
 * PostgreSQL has no equivalent, so the cleanup is folded into the write path.
 * The grace period keeps rows around briefly for troubleshooting a failed login.
 */
const RETENTION_INTERVAL = '1 day';

interface OtpRow {
  id: string;
  identifier: string;
  purpose: string;
  code_hash: string;
  attempts: number;
  consumed: boolean;
  expires_at: Date | null;
  created_at: Date | null;
}

const mapOtp = (row: OtpRow): IOtpCode => ({
  _id: String(row.id),
  identifier: row.identifier,
  purpose: row.purpose,
  codeHash: row.code_hash,
  attempts: toNum(row.attempts),
  consumed: toBool(row.consumed),
  expiresAt: toDate(row.expires_at),
  createdAt: toDate(row.created_at),
});

export class OtpCodeRepository {
  public async create(
    identifier: string,
    purpose: string,
    codeHash: string,
    expiresAt: Date,
  ): Promise<IOtpCode> {
    // Stands in for Mongo's TTL index. Cheap (indexed on expires_at) and only
    // runs on the already-infrequent code-issue path.
    await query(
      `DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '${RETENTION_INTERVAL}'`,
    );

    const row = await queryOne<OtpRow>(
      `INSERT INTO otp_codes (identifier, purpose, code_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, identifier, purpose, code_hash, attempts, consumed, expires_at, created_at`,
      [String(identifier ?? '').toLowerCase().trim(), purpose, codeHash, expiresAt],
    );

    return mapOtp(row!);
  }

  /** The most recent unconsumed, unexpired, not-yet-locked-out code for this identifier+purpose. */
  public async findActive(identifier: string, purpose: string): Promise<IOtpCode | null> {
    const row = await queryOne<OtpRow>(
      `SELECT id, identifier, purpose, code_hash, attempts, consumed, expires_at, created_at
       FROM otp_codes
       WHERE identifier = $1
         AND purpose = $2
         AND consumed = FALSE
         AND expires_at > NOW()
         AND attempts < $3
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [String(identifier ?? '').toLowerCase().trim(), purpose, MAX_ATTEMPTS],
    );

    return row ? mapOtp(row) : null;
  }

  public async incrementAttempts(id: string): Promise<void> {
    const otpId = toBigIntParam(id);
    if (!otpId) return;
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otpId]);
  }

  public async markConsumed(id: string): Promise<void> {
    const otpId = toBigIntParam(id);
    if (!otpId) return;
    await query('UPDATE otp_codes SET consumed = TRUE WHERE id = $1', [otpId]);
  }
}
