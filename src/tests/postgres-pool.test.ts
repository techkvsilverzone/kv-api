// A connection string must be present for the pool to construct at all. Supplying
// it here rather than reading the developer's .env keeps the suite hermetic —
// nothing below ever opens a socket, since pg's connect/query are stubbed.
jest.mock('../config', () => {
  const actual = jest.requireActual('../config');
  return {
    config: {
      ...actual.config,
      postgres: { ...actual.config.postgres, url: 'postgresql://test:test@localhost:5432/test' },
    },
  };
});

import { Pool } from 'pg';
import { pingPostgres, withTransaction, disconnectPostgres } from '../infrastructure/postgres/pool';

/**
 * The transaction and health primitives every repository is built on.
 *
 * `pg.Pool.prototype.connect` / `.query` are stubbed, so these assert the
 * BEGIN/COMMIT/ROLLBACK protocol and client release without needing a database.
 */
describe('PostgreSQL pool', () => {
  const makeClient = () => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await disconnectPostgres();
  });

  const stubConnect = (client: ReturnType<typeof makeClient>) =>
    jest.spyOn(Pool.prototype, 'connect').mockResolvedValue(client as never);

  describe('withTransaction', () => {
    it('wraps the work in BEGIN/COMMIT and releases the client', async () => {
      const client = makeClient();
      stubConnect(client);

      const result = await withTransaction(async (c) => {
        await c.query('INSERT INTO orders DEFAULT VALUES');
        return 'done';
      });

      expect(result).toBe('done');
      const statements = client.query.mock.calls.map((call) => call[0]);
      expect(statements[0]).toBe('BEGIN');
      expect(statements[statements.length - 1]).toBe('COMMIT');
      expect(statements).not.toContain('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('rolls back and rethrows when the work throws', async () => {
      const client = makeClient();
      stubConnect(client);
      const failure = new Error('constraint violation');

      await expect(
        withTransaction(async () => {
          throw failure;
        }),
      ).rejects.toThrow(failure);

      const statements = client.query.mock.calls.map((call) => call[0]);
      expect(statements).toContain('ROLLBACK');
      expect(statements).not.toContain('COMMIT');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('surfaces the original error even when the rollback itself fails', async () => {
      const client = makeClient();
      client.query.mockImplementation(async (sql: string) => {
        if (sql === 'ROLLBACK') throw new Error('connection already gone');
        return { rows: [], rowCount: 0 };
      });
      stubConnect(client);

      // A failed rollback must not mask why the transaction aborted — otherwise
      // the log shows a connection blip instead of the real constraint error.
      await expect(
        withTransaction(async () => {
          throw new Error('duplicate key value violates unique constraint');
        }),
      ).rejects.toThrow('duplicate key value violates unique constraint');

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('releases the client even when acquiring succeeded but BEGIN fails', async () => {
      const client = makeClient();
      client.query.mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN') throw new Error('server closed the connection');
        return { rows: [], rowCount: 0 };
      });
      stubConnect(client);

      await expect(withTransaction(async () => 'unreachable')).rejects.toThrow(
        'server closed the connection',
      );
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('pingPostgres', () => {
    it('returns true when SELECT 1 succeeds', async () => {
      jest.spyOn(Pool.prototype, 'query').mockResolvedValue({ rows: [{ '?column?': 1 }] } as never);

      await expect(pingPostgres()).resolves.toBe(true);
    });

    it('returns false rather than throwing when the database is unreachable', async () => {
      jest.spyOn(Pool.prototype, 'query').mockImplementation(() => {
        throw new Error('ECONNREFUSED');
      });

      // The health endpoint depends on this never throwing — it must be able to
      // report DOWN, not crash the request.
      await expect(pingPostgres()).resolves.toBe(false);
    });
  });
});
