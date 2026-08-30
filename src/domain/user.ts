/**
 * User domain model — the plain-TypeScript replacement for the Mongoose
 * `IUser`/`IAddress` document interfaces.
 *
 * `_id` is a string carrying the PostgreSQL BIGINT identity. It is deliberately
 * NOT renamed to `id`: every service, response mapper and test already reads
 * `user._id.toString()` / `String(address._id)`, and the API has always emitted
 * `_id`. Keeping the key preserves both the internal call sites (spec §45) and
 * the client-facing contract (spec §4) while the value underneath moves from a
 * Mongo ObjectId to a PostgreSQL id (spec §7).
 */

export interface IAddress {
  _id: string;
  label?: string | null;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
}

export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string | null;
  /** Verified via a WhatsApp/email OTP sent at signup (item 1, mobile verification). */
  phoneVerified: boolean;
  isAdmin: boolean;
  isActive: boolean;
  role?: 'admin' | 'staff' | 'customer' | null;
  isStallRegistration?: boolean;
  /** Used for the daily WhatsApp birthday-wish cron (year is ignored — only month/day matter). */
  dateOfBirth?: Date | null;
  /** Used for the daily WhatsApp wedding-anniversary-wish cron. */
  anniversaryDate?: Date | null;
  addresses: IAddress[];
  createdAt: Date | null;
  updatedAt: Date | null;
}
