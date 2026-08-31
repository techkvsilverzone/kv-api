import { query, queryOne, queryRows } from '../infrastructure/postgres/pool';
import { toBigIntParam, toId, toNullableText } from '../infrastructure/postgres/mapping';
import { IIdProofUserRef, IUserIdProof, IdProofType, IdProofVerificationStatus } from '../domain/idProof';

interface IdProofRow {
  id: string;
  user_id: string;
  id_proof_type: string;
  id_proof_number: string;
  image_url: string;
  verification_status: string;
  verified_by: string | null;
  verified_at: Date | null;
  rejection_reason: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  user_name?: string;
  user_email?: string;
  user_phone?: string | null;
}

const SELECT_WITH_USER = `
  SELECT
    p.id, p.user_id, p.id_proof_type, p.id_proof_number, p.image_url,
    p.verification_status, p.verified_by, p.verified_at, p.rejection_reason,
    p.created_at, p.updated_at,
    u.name AS user_name, u.email AS user_email, u.phone AS user_phone
  FROM user_id_proofs p
  JOIN users u ON u.id = p.user_id`;

const mapRow = (row: IdProofRow): IUserIdProof => {
  const userRef: IIdProofUserRef | null = row.user_name
    ? { _id: String(row.user_id), name: row.user_name, email: row.user_email ?? '', phone: row.user_phone }
    : null;

  return {
    _id: String(row.id),
    userId: userRef ?? String(row.user_id),
    idProofType: row.id_proof_type as IdProofType,
    idProofNumber: row.id_proof_number,
    imageUrl: row.image_url,
    verificationStatus: row.verification_status as IdProofVerificationStatus,
    verifiedBy: toId(row.verified_by),
    verifiedAt: row.verified_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export class IdProofRepository {
  public async findByUserId(userId: string): Promise<IUserIdProof | null> {
    const ownerId = toBigIntParam(userId);
    if (!ownerId) return null;
    const row = await queryOne<IdProofRow>(`${SELECT_WITH_USER} WHERE p.user_id = $1`, [ownerId]);
    return row ? mapRow(row) : null;
  }

  public async findById(id: string): Promise<IUserIdProof | null> {
    const proofId = toBigIntParam(id);
    if (!proofId) return null;
    const row = await queryOne<IdProofRow>(`${SELECT_WITH_USER} WHERE p.id = $1`, [proofId]);
    return row ? mapRow(row) : null;
  }

  /**
   * Submit or resubmit a customer's own ID proof. Always resets to 'Pending' and clears any
   * prior rejection — a resubmission after a 'Rejected' verdict is a fresh document, not an edit
   * of the old one, even though it reuses the same one-row-per-user record.
   */
  public async submit(
    userId: string,
    data: { idProofType: IdProofType; idProofNumber: string; imageUrl: string },
  ): Promise<IUserIdProof> {
    const ownerId = toBigIntParam(userId);
    if (!ownerId) throw new Error('Invalid user id');

    await query(
      `INSERT INTO user_id_proofs (user_id, id_proof_type, id_proof_number, image_url, verification_status, verified_by, verified_at, rejection_reason)
       VALUES ($1, $2, $3, $4, 'Pending', NULL, NULL, NULL)
       ON CONFLICT (user_id) DO UPDATE SET
         id_proof_type = EXCLUDED.id_proof_type,
         id_proof_number = EXCLUDED.id_proof_number,
         image_url = EXCLUDED.image_url,
         verification_status = 'Pending',
         verified_by = NULL,
         verified_at = NULL,
         rejection_reason = NULL,
         updated_at = NOW()`,
      [ownerId, data.idProofType, data.idProofNumber, data.imageUrl],
    );

    const created = await this.findByUserId(userId);
    if (!created) throw new Error('ID proof upsert succeeded but the row could not be read back.');
    return created;
  }

  public async verify(
    id: string,
    data: { status: 'Verified' | 'Rejected'; verifiedBy: string; rejectionReason?: string | null },
  ): Promise<IUserIdProof | null> {
    const proofId = toBigIntParam(id);
    const verifierId = toBigIntParam(data.verifiedBy);
    if (!proofId || !verifierId) return null;

    const result = await query(
      `UPDATE user_id_proofs
       SET verification_status = $1, verified_by = $2, verified_at = NOW(),
           rejection_reason = $3, updated_at = NOW()
       WHERE id = $4`,
      [data.status, verifierId, data.status === 'Rejected' ? toNullableText(data.rejectionReason) : null, proofId],
    );
    if (!result.rowCount) return null;
    return this.findById(id);
  }

  /** Admin queue — all submissions, optionally filtered by status, newest first. */
  public async findAll(status?: IdProofVerificationStatus): Promise<IUserIdProof[]> {
    const rows = status
      ? await queryRows<IdProofRow>(
          `${SELECT_WITH_USER} WHERE p.verification_status = $1 ORDER BY p.created_at DESC, p.id DESC`,
          [status],
        )
      : await queryRows<IdProofRow>(`${SELECT_WITH_USER} ORDER BY p.created_at DESC, p.id DESC`);
    return rows.map(mapRow);
  }
}
