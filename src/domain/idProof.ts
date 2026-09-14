/**
 * Item 2 (business requirement, 2026-08-30; tightened 2026-09-14): KYC identity verification,
 * required once per customer (not per scheme — the same submission covers every scheme a
 * customer joins), but re-checked on every enrollment attempt (see `SavingsService.enroll`).
 * A customer must have an admin-approved (`Verified`) submission on file before enrolling in
 * ANY plan — a merely-submitted or rejected one blocks enrollment, so no one can end up signed
 * up, even by mistake, without a verified ID on file.
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
