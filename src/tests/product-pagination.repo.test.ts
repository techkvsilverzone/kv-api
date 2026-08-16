import { ProductRepository } from '../repositories/product.repository';
import * as pool from '../infrastructure/postgres/pool';

// Verifies GET /products pagination (page/limit) is translated into the correct
// SQL LIMIT/OFFSET on the filtered+sorted query. Mocks the pool so no DB is
// required, matching the project's data-access-layer mocking convention.
describe('ProductRepository.findAll pagination', () => {
  afterEach(() => jest.restoreAllMocks());

  /** Captures the SQL text and bound parameters of the next findAll query. */
  function captureQuery() {
    const captured: { sql: string; params: readonly unknown[] } = { sql: '', params: [] };
    jest.spyOn(pool, 'queryRows').mockImplementation(async (sql, params = []) => {
      captured.sql = sql;
      captured.params = params;
      return [] as never[];
    });
    return captured;
  }

  /**
   * Resolves the value bound to `LIMIT $n` / `OFFSET $n`, so the assertions test
   * the effective values rather than the placeholder numbering — which shifts
   * with however many filters happen to precede them.
   */
  function paging(captured: { sql: string; params: readonly unknown[] }) {
    const match = captured.sql.match(/LIMIT \$(\d+) OFFSET \$(\d+)/);
    if (!match) return { limit: undefined, offset: undefined };
    return {
      limit: captured.params[Number(match[1]) - 1],
      offset: captured.params[Number(match[2]) - 1],
    };
  }

  it('applies limit/offset for page 2, limit 12', async () => {
    const captured = captureQuery();
    await new ProductRepository().findAll({ page: '2', limit: '12' });
    expect(paging(captured)).toEqual({ limit: 12, offset: 12 });
  });

  it('defaults to page 1 (offset 0) when page is omitted', async () => {
    const captured = captureQuery();
    await new ProductRepository().findAll({ limit: '12' });
    expect(paging(captured)).toEqual({ limit: 12, offset: 0 });
  });

  it('returns the full set (no limit/offset) when limit is absent', async () => {
    const captured = captureQuery();
    await new ProductRepository().findAll({ category: 'Rings' });
    expect(captured.sql).not.toMatch(/LIMIT/);
    expect(captured.sql).not.toMatch(/OFFSET/);
  });

  it('ignores an invalid limit and returns the full set', async () => {
    const captured = captureQuery();
    await new ProductRepository().findAll({ page: '1', limit: 'abc' });
    expect(captured.sql).not.toMatch(/LIMIT/);
    expect(captured.sql).not.toMatch(/OFFSET/);
  });

  it('caps an oversized limit at 100', async () => {
    const captured = captureQuery();
    await new ProductRepository().findAll({ page: '3', limit: '1000' });
    // limit capped to 100, so page 3 ⇒ offset (3-1)*100 = 200
    expect(paging(captured)).toEqual({ limit: 100, offset: 200 });
  });

  it('binds filter values as parameters rather than interpolating them', async () => {
    const captured = captureQuery();
    await new ProductRepository().findAll({ category: "Rings'; DROP TABLE products; --" });

    expect(captured.sql).not.toMatch(/DROP TABLE/);
    expect(captured.params).toContainEqual(["Rings'; DROP TABLE products; --"]);
  });
});
