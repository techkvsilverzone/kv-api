/**
 * Item 2 (business requirement, 2026-08-30; tightened 2026-09-14, then REPLACED 2026-09-16):
 * KYC identity document, submitted once per customer (not per scheme) and reviewed by an
 * admin/staff (see `IdProofController`/the admin Savings KYC queue). This document is no
 * longer wired into `SavingsService.enroll()` — enrollment is gated by a fresh OTP
 * confirmation instead (`OtpService.requestEnrollmentOtp`/`verifyEnrollmentOtp`), which is
 * instant/self-serve rather than waiting on async admin review. Submission/review still exist
 * here for record-keeping; nothing currently blocks on `verificationStatus`.
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
