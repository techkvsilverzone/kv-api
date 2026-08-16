import bcrypt from 'bcryptjs';
import { PoolClient } from 'pg';
import { IUser, IAddress } from '../domain/user';
import { query, queryOne, queryRows, withTransaction } from '../infrastructure/postgres/pool';
import {
  dateOnlyToDate,
  toBigIntParam,
  toBool,
  toDate,
  toDateOnlyParam,
  toNullableText,
} from '../infrastructure/postgres/mapping';

export { IUser, IAddress };

export interface AddressData {
  label?: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault?: boolean;
}

export interface IUserWithPassword extends IUser {
  passwordHash: string;
}

/**
 * Addresses used to be an embedded array on the user document, and every
 * consumer still expects to find them at `user.addresses`. They now live in
 * `user_addresses`, so each user read aggregates them back into that nested
 * shape rather than exposing the join to callers (spec §30).
 *
 * Ordering is by `id` — insertion order, which is what the embedded array
 * gave us. `deleteAddress` promoting "the first remaining address" therefore
 * still means the same address it did before the migration.
 */
const ADDRESS_JSON = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          '_id', ua.id::text,
          'label', ua.label,
          'firstName', ua.first_name,
          'lastName', ua.last_name,
          'address', ua.address,
          'city', ua.city,
          'state', ua.state,
          'pincode', ua.pincode,
          'phone', ua.phone,
          'isDefault', ua.is_default
        )
        ORDER BY ua.id
      )
      FROM user_addresses ua
      WHERE ua.user_id = u.id
    ),
    '[]'::json
  ) AS addresses`;

const USER_SELECT = `
  SELECT
    u.id, u.name, u.email, u.password_hash, u.phone, u.is_admin, u.is_active,
    u.role, u.is_stall_registration, u.date_of_birth, u.anniversary_date,
    u.created_at, u.updated_at,
    ${ADDRESS_JSON}
  FROM users u`;

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string | null;
  is_admin: boolean;
  is_active: boolean;
  role: string | null;
  is_stall_registration: boolean;
  date_of_birth: string | null;
  anniversary_date: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  addresses: unknown;
}

const mapAddress = (raw: Record<string, unknown>): IAddress => ({
  _id: String(raw._id),
  label: (raw.label as string | null) ?? null,
  firstName: String(raw.firstName ?? ''),
  lastName: String(raw.lastName ?? ''),
  address: String(raw.address ?? ''),
  city: String(raw.city ?? ''),
  state: String(raw.state ?? ''),
  pincode: String(raw.pincode ?? ''),
  phone: String(raw.phone ?? ''),
  isDefault: Boolean(raw.isDefault),
});

const mapUser = (row: UserRow): IUser => ({
  _id: String(row.id),
  name: row.name,
  email: row.email,
  passwordHash: row.password_hash,
  phone: row.phone,
  isAdmin: toBool(row.is_admin),
  isActive: toBool(row.is_active, true),
  role: (row.role as IUser['role']) ?? null,
  isStallRegistration: toBool(row.is_stall_registration),
  dateOfBirth: dateOnlyToDate(row.date_of_birth),
  anniversaryDate: dateOnlyToDate(row.anniversary_date),
  addresses: Array.isArray(row.addresses)
    ? (row.addresses as Record<string, unknown>[]).map(mapAddress)
    : [],
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

/**
 * Columns a caller may set through `update`.
 *
 * `updateProfile` forwards the raw request body, so this whitelist is what
 * stops an arbitrary key from reaching the statement. It is also why the SET
 * clause can safely be assembled from keys — only names from this map are ever
 * emitted, and every value goes through a bound parameter (spec §27).
 */
const UPDATABLE_COLUMNS: Record<string, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  isAdmin: 'is_admin',
  isActive: 'is_active',
  role: 'role',
  isStallRegistration: 'is_stall_registration',
  dateOfBirth: 'date_of_birth',
  anniversaryDate: 'anniversary_date',
  passwordHash: 'password_hash',
};

const DATE_ONLY_FIELDS = new Set(['dateOfBirth', 'anniversaryDate']);

export class UserRepository {
  public async create(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    isStallRegistration?: boolean;
  }): Promise<IUser> {
    // Hashing is unchanged: same bcrypt, same cost factor. Existing hashes
    // migrated verbatim into users.password_hash and still verify (spec §11).
    const passwordHash = await bcrypt.hash(data.password, 10);

    const row = await queryOne<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, phone, is_stall_registration)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        String(data.name ?? '').trim(),
        String(data.email ?? '').toLowerCase().trim(),
        passwordHash,
        toNullableText(data.phone),
        data.isStallRegistration ?? false,
      ],
    );

    const created = await this.findById(String(row!.id));
    if (!created) throw new Error('User insert succeeded but the row could not be read back.');
    return created;
  }

  public async findByEmail(email: string): Promise<IUser | null> {
    const row = await queryOne<UserRow>(
      `${USER_SELECT} WHERE u.email = $1 AND u.is_active = TRUE`,
      [String(email ?? '').toLowerCase().trim()],
    );
    return row ? mapUser(row) : null;
  }

  public async findById(id: string): Promise<IUser | null> {
    const userId = toBigIntParam(id);
    if (!userId) return null;

    const row = await queryOne<UserRow>(`${USER_SELECT} WHERE u.id = $1`, [userId]);
    return row ? mapUser(row) : null;
  }

  public async update(
    id: string,
    data: Partial<IUser & { password?: string }>,
  ): Promise<IUser | null> {
    const userId = toBigIntParam(id);
    if (!userId) return null;

    if (data.email) {
      const clash = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [String(data.email).toLowerCase().trim(), userId],
      );
      if (clash) throw new Error('Email already in use');
    }

    const assignments: string[] = [];
    const values: unknown[] = [];

    const push = (column: string, value: unknown): void => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };

    for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
      const value = (data as Record<string, unknown>)[field];
      if (value === undefined) continue;

      if (field === 'email') {
        push(column, String(value).toLowerCase().trim());
      } else if (DATE_ONLY_FIELDS.has(field)) {
        push(column, toDateOnlyParam(value));
      } else {
        push(column, value);
      }
    }

    // A plaintext `password` is hashed here and written to password_hash; the
    // caller never sees or stores the plaintext.
    if (data.password) {
      push('password_hash', await bcrypt.hash(data.password, 10));
    }

    if (!assignments.length) return this.findById(id);

    values.push(userId);
    const result = await query(
      `UPDATE users SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
      values,
    );

    if (!result.rowCount) return null;
    return this.findById(id);
  }

  public async findAll(): Promise<IUser[]> {
    const rows = await queryRows<UserRow>(
      `${USER_SELECT} WHERE u.is_active = TRUE ORDER BY u.created_at DESC, u.id DESC`,
    );
    return rows.map(mapUser);
  }

  public async findRegularCustomers(): Promise<IUser[]> {
    const rows = await queryRows<UserRow>(
      `${USER_SELECT}
       WHERE u.is_active = TRUE AND u.is_admin = FALSE
       ORDER BY u.created_at DESC, u.id DESC`,
    );
    return rows.map(mapUser);
  }

  /**
   * Active users with a phone number and at least one celebration date set —
   * the candidate pool for the daily birthday/anniversary WhatsApp cron.
   *
   * Replaces a `User.find(...)` that `birthdayWish.service.ts` used to run
   * directly against Mongoose, which bypassed the repository boundary.
   */
  public async findCelebrationCandidates(): Promise<IUser[]> {
    const rows = await queryRows<UserRow>(
      `${USER_SELECT}
       WHERE u.is_active = TRUE
         AND u.phone IS NOT NULL
         AND u.phone <> ''
         AND (u.date_of_birth IS NOT NULL OR u.anniversary_date IS NOT NULL)
       ORDER BY u.id`,
    );
    return rows.map(mapUser);
  }

  // ── Address book ─────────────────────────────────────────────────────

  public async getAddresses(userId: string): Promise<IAddress[]> {
    const user = await this.findById(userId);
    return user ? user.addresses : [];
  }

  /** Clear every default flag for a user. Callers are already inside a transaction. */
  private async clearDefaults(client: PoolClient, userId: string): Promise<void> {
    await client.query(
      'UPDATE user_addresses SET is_default = FALSE, updated_at = NOW() WHERE user_id = $1',
      [userId],
    );
  }

  public async addAddress(userId: string, data: AddressData): Promise<IAddress | null> {
    const ownerId = toBigIntParam(userId);
    if (!ownerId) return null;

    const addressId = await withTransaction(async (client) => {
      // Lock the user row so two concurrent adds cannot both decide they are
      // the first address and both claim the default flag.
      const owner = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [ownerId]);
      if (!owner.rowCount) return null;

      const existing = await client.query<{ count: string }>(
        'SELECT count(*)::int AS count FROM user_addresses WHERE user_id = $1',
        [ownerId],
      );

      // First address is always default; an explicit default unsets the others.
      const makeDefault = data.isDefault === true || Number(existing.rows[0].count) === 0;
      if (makeDefault) await this.clearDefaults(client, ownerId);

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO user_addresses
           (user_id, label, first_name, last_name, address, city, state, pincode, phone, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          ownerId,
          toNullableText(data.label),
          data.firstName,
          data.lastName,
          data.address,
          data.city,
          data.state,
          data.pincode,
          data.phone,
          makeDefault,
        ],
      );

      return String(inserted.rows[0].id);
    });

    if (!addressId) return null;
    return this.findAddress(ownerId, addressId);
  }

  public async updateAddress(
    userId: string,
    addressId: string,
    data: Partial<AddressData>,
  ): Promise<IAddress | null> {
    const ownerId = toBigIntParam(userId);
    const targetId = toBigIntParam(addressId);
    if (!ownerId || !targetId) return null;

    const updated = await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [targetId, ownerId],
      );
      if (!existing.rowCount) return false;

      if (data.isDefault === true) await this.clearDefaults(client, ownerId);

      const columns: Record<string, unknown> = {
        label: data.label,
        first_name: data.firstName,
        last_name: data.lastName,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        phone: data.phone,
        is_default: data.isDefault,
      };

      const assignments: string[] = [];
      const values: unknown[] = [];

      for (const [column, value] of Object.entries(columns)) {
        if (value === undefined) continue;
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      }

      if (assignments.length) {
        values.push(targetId);
        await client.query(
          `UPDATE user_addresses
           SET ${assignments.join(', ')}, updated_at = NOW()
           WHERE id = $${values.length}`,
          values,
        );
      }

      return true;
    });

    if (!updated) return null;
    return this.findAddress(ownerId, targetId);
  }

  public async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const ownerId = toBigIntParam(userId);
    const targetId = toBigIntParam(addressId);
    if (!ownerId || !targetId) return false;

    return withTransaction(async (client) => {
      const existing = await client.query<{ is_default: boolean }>(
        'DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 RETURNING is_default',
        [targetId, ownerId],
      );
      if (!existing.rowCount) return false;

      // Promote a remaining address to default if we removed the default one.
      if (existing.rows[0].is_default) {
        await client.query(
          `UPDATE user_addresses
           SET is_default = TRUE, updated_at = NOW()
           WHERE id = (
             SELECT id FROM user_addresses WHERE user_id = $1 ORDER BY id LIMIT 1
           )`,
          [ownerId],
        );
      }

      return true;
    });
  }

  private async findAddress(userId: string, addressId: string): Promise<IAddress | null> {
    const row = await queryOne<Record<string, unknown>>(
      `SELECT
         id::text AS "_id", label, first_name AS "firstName", last_name AS "lastName",
         address, city, state, pincode, phone, is_default AS "isDefault"
       FROM user_addresses
       WHERE id = $1 AND user_id = $2`,
      [addressId, userId],
    );
    return row ? mapAddress(row) : null;
  }
}
