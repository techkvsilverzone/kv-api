/**
 * Row → domain mapping helpers shared by every PostgreSQL repository.
 *
 * These exist so the `pg` representation (bigint-as-string, nullable columns,
 * text[] arrays) is normalised in exactly one place rather than re-derived in
 * 25 repositories.
 */

/**
 * An identity key as the application sees it: a string.
 *
 * PostgreSQL BIGINT exceeds JS's safe integer range, and node-pg therefore
 * hands it back as a string. Keeping it a string all the way to the client
 * also keeps the JSON contract stable and makes ids opaque, which is what
 * every consumer already assumes.
 */
export type Id = string;

/** BIGINT column → string id, preserving null. */
export const toId = (value: unknown): Id | null =>
  value === null || value === undefined ? null : String(value);

/** BIGINT column → string id for NOT NULL columns. */
export const requireId = (value: unknown): Id => String(value);

/**
 * Accepts whatever a caller passes as an id (string, number) and returns a
 * value safe to bind to a BIGINT parameter, or null when it could never match
 * a row. Guarding here means a stray Mongo ObjectId from an old client or
 * cookie produces a clean "not found" instead of a 500 from PostgreSQL's
 * "invalid input syntax for type bigint".
 */
export const toBigIntParam = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  return /^\d+$/.test(raw) ? raw : null;
};

/** NUMERIC/INTEGER column → number, with a default for null. */
export const toNum = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** NUMERIC column → number | null, preserving a genuine null. */
export const toNumOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** BOOLEAN column → boolean, with a default for null. */
export const toBool = (value: unknown, fallback = false): boolean =>
  value === null || value === undefined ? fallback : Boolean(value);

/** BOOLEAN column → boolean | null, preserving a genuine null. */
export const toBoolOrNull = (value: unknown): boolean | null =>
  value === null || value === undefined ? null : Boolean(value);

/** TIMESTAMPTZ column → Date | null. */
export const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * DATE column ('YYYY-MM-DD', per the parser in pool.ts) → a Date pinned to UTC
 * midnight.
 *
 * `new Date('1990-05-12')` already parses as UTC, but going through the
 * explicit suffix documents the intent and guards against a bare 'YYYY-M-D'
 * ever slipping through as local time. Serialising to UTC midnight reproduces
 * exactly what the Mongo-backed API emitted for these fields
 * ("1990-05-12T00:00:00.000Z"), so the response contract is unchanged.
 */
export const dateOnlyToDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return toDate(raw);
  const [, year, month, day] = match;
  return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
};

/** Date | string → 'YYYY-MM-DD' for binding to a DATE column. */
export const toDateOnlyParam = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

/** text[] column → string[], never null. */
export const toStrArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

/** Trim a string, mapping blank/absent to null. */
export const toNullableText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Build the `SET` clause of an UPDATE from a sparse patch.
 *
 * Only keys explicitly present in `columns` are emitted, so a partial update
 * never clobbers a column the caller did not mention — the semantics Mongoose's
 * `$set` gave us for free.
 *
 * Returns null when there is nothing to update, letting the caller skip the
 * round trip entirely.
 */
export const buildUpdate = (
  columns: Record<string, unknown>,
  startIndex = 1,
): { clause: string; values: unknown[]; nextIndex: number } | null => {
  const assignments: string[] = [];
  const values: unknown[] = [];
  let index = startIndex;

  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    assignments.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  }

  if (!assignments.length) return null;

  return { clause: assignments.join(', '), values, nextIndex: index };
};
