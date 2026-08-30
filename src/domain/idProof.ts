/**
 * Item 2 (business requirement, 2026-08-30): KYC identity verification, required once per
 * customer before their first savings-scheme enrollment (see `SavingsService.enroll`), not
 * per-scheme — the same submission covers every scheme a customer joins. Verification is
 * ASYNC/non-blocking: a customer can enroll the moment they submit, while an admin/staff
 * reviews the document in the background (see `docs/16-pending-schema-changes.md` for the
 * (unapplied) `user_id_proofs` table this maps to).
 */

export type IdProofType = 'AADHAAR' | 'PAN' | 'VOTER_ID' | 'DRIVING_LICENSE';
export type IdProofVerificationStatus = 'Pending' | 'Verified' | 'Rejected';

/** Present when the query joined the owner, standing in for the old `populate`. */
export interface IIdProofUserRef {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface IUserIdProof {
  _id: string;
  userId: string | IIdProofUserRef;
  idProofType: IdProofType;
  idProofNumber: string;
  /** Public URL of the uploaded document photo — same disk-backed storage as product images. */
  imageUrl: string;
  verificationStatus: IdProofVerificationStatus;
  verifiedBy?: string | null;
  verifiedAt?: Date | null;
  /** Set when verificationStatus is 'Rejected'; cleared on resubmission. */
  rejectionReason?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
