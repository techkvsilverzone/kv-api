import bcrypt from 'bcryptjs';
import Logger from './logger';
import { query } from '../infrastructure/postgres/pool';

/**
 * Ensures the built-in admin and staff accounts exist with known credentials.
 * Runs on every boot (see server.ts), so it must be idempotent.
 *
 * `ON CONFLICT (email)` collapses the previous find-then-update-or-create pair
 * into one atomic statement — two instances starting simultaneously can no
 * longer race to insert the same account.
 */
const upsertSystemUser = async (params: {
  email: string;
  name: string;
  password: string;
  isAdmin: boolean;
  role: 'admin' | 'staff';
}): Promise<void> => {
  const passwordHash = await bcrypt.hash(params.password, 10);

  const result = await query<{ inserted: boolean }>(
    `INSERT INTO users (email, password_hash, name, is_admin, role, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name          = EXCLUDED.name,
       is_admin      = EXCLUDED.is_admin,
       role          = EXCLUDED.role,
       is_active     = TRUE,
       updated_at    = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [params.email, passwordHash, params.name, params.isAdmin, params.role],
  );

  const inserted = result.rows[0]?.inserted === true;
  Logger.info(
    inserted
      ? `Default ${params.role} user created successfully (${params.email})`
      : `${params.role} user already exists (updated password/hash)`,
  );
};

export const seedAdmin = async () => {
  try {
    await upsertSystemUser({
      email: 'admin@kvsilverzone.com',
      name: 'System Admin',
      password: 'adminkvz123',
      isAdmin: true,
      role: 'admin',
    });

    await upsertSystemUser({
      email: 'staff@kvsilverzone.com',
      name: 'System Staff',
      password: 'staffkvz123',
      isAdmin: false,
      role: 'staff',
    });
  } catch (error) {
    Logger.error(`Error seeding admin user: ${String(error)}`);
  }
};
