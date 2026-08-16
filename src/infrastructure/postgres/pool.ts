import { Pool, PoolClient, QueryResult, QueryResultRow, types as pgTypes } from 'pg';
import { config } from '../../config';
import Logger from '../../utils/logger';

/**
 * Type parsers, applied once at module load so every query — pooled or not —
 * decodes identically.
 *
 * DATE (oid 1082): node-pg would build a JS Date at the *server's* local
 * midnight, which silently shifts the calendar day either side of UTC. Every
 * date-typed column here (metal_rates.rate_date, users.date_of_birth, ...) is
 * a calendar day, not an instant, so it stays the raw 'YYYY-MM-DD' string.
 *
 * NUMERIC (oid 1700): node-pg returns these as strings to protect precision.
 * The pre-migration Mongo code stored and computed every money/weight value as
 * a JS number, so parsing to Number preserves existing behaviour exactly
 * (spec §45). Precision is unchanged for the magnitudes involved here.
 *
 * INT8 (oid 20): left as the default string. Identity keys are surfaced as
 * strings by the mappers, which keeps them safe past 2^53 and keeps the JSON
 * shape ("id": "12") stable for clients.
 */
pgTypes.setTypeParser(pgTypes.builtins.DATE, (value: string) => value);
pgTypes.setTypeParser(pgTypes.builtins.NUMERIC, (value: string) => Number(value));

/**
 * The single PostgreSQL connection point for the whole runtime.
 *
 * Nothing outside this module may construct a `Pool` — services talk to
 * repositories, repositories talk to `query`/`withTransaction`, and the
 * `pg` types (`QueryResult`, `PoolClient`) never escape the repository layer.
 *
 * Connection details come exclusively from `config.postgres`, which reads
 * `POSTGRES_URL`. Host, port, user, password, database and SSL are never
 * hard-coded here. `POSTGRES_MIGRATION_URL` is deliberately NOT consulted —
 * that variable belongs to the one-off scripts in `src/migration/`.
 */

let pool: Pool | null = null;

/** Lazily create the shared pool. Safe to call repeatedly. */
export const getPool = (): Pool => {
  if (pool) return pool;

  const { url, max, idleTimeoutMillis, connectionTimeoutMillis, statementTimeoutMillis, ssl } =
    config.postgres;

  if (!url) {
    throw new Error(
      'POSTGRES_URL is not set. The API requires a PostgreSQL connection string.',
    );
  }

  pool = new Pool({
    connectionString: url,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    // Applied per connection so a runaway query can never pin a pool slot forever.
    statement_timeout: statementTimeoutMillis,
    ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  // An idle client erroring (server restart, network blip) emits on the pool.
  // Without a listener Node treats it as an unhandled 'error' event and exits.
  pool.on('error', (error: Error) => {
    Logger.error(`[postgres] idle client error: ${error.message}`);
  });

  return pool;
};

/**
 * Run a parameterized statement. Values MUST be passed via `params` —
 * never interpolated into `text`.
 */
export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> => getPool().query<T>(text, params as unknown[]);

/** Convenience: the rows of a parameterized statement. */
export const queryRows = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> => (await query<T>(text, params)).rows;

/** Convenience: the first row of a parameterized statement, or null. */
export const queryOne = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> => (await query<T>(text, params)).rows[0] ?? null;

/**
 * Run `work` inside a single transaction on one dedicated client.
 *
 * Commits on success, rolls back on any throw, and always releases the client.
 * Use for anything that must be atomic — order creation + items + stock,
 * payment confirmation + order state, multi-row cart writes, savings
 * installments, passbook generation.
 */
export const withTransaction = async <T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // A rollback failure must not mask the error that caused it.
    await client.query('ROLLBACK').catch((rollbackError: unknown) => {
      Logger.error(`[postgres] rollback failed: ${String(rollbackError)}`);
    });
    throw error;
  } finally {
    client.release();
  }
};

/** Verify the connection is usable. Backs the /health endpoint. */
export const pingPostgres = async (): Promise<boolean> => {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    Logger.error(`[postgres] health check failed: ${String(error)}`);
    return false;
  }
};

/**
 * Establish and verify connectivity at boot. Throws if the database is
 * unreachable, so the process fails fast instead of serving 500s.
 */
export const connectPostgres = async (): Promise<void> => {
  const result = await query<{ db: string; usr: string }>(
    'SELECT current_database() AS db, current_user AS usr',
  );
  const { db, usr } = result.rows[0];
  Logger.info(`Connected to PostgreSQL (${db} as ${usr})`);
};

/** Close the pool. Idempotent — safe to call from multiple shutdown paths. */
export const disconnectPostgres = async (): Promise<void> => {
  if (!pool) return;

  const closing = pool;
  pool = null;

  try {
    await closing.end();
    Logger.info('PostgreSQL pool closed');
  } catch (error) {
    Logger.error(`[postgres] error closing pool: ${String(error)}`);
  }
};
