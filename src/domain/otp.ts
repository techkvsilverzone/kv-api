/** One-time login / password-reset code. Plain replacement for the Mongoose `IOtpCode`. */
export interface IOtpCode {
  _id: string;
  identifier: string;
  purpose: string;
  codeHash: string;
  attempts: number;
  consumed: boolean;
  expiresAt: Date | null;
  createdAt: Date | null;
}
