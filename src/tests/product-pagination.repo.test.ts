import { ProductRepository } from '../repositories/product.repository';
import { Product } from '../models/product.model';

// Verifies GET /products pagination (page/limit) is translated into the correct
// Mongo skip()/limit() on the filtered+sorted cursor. Mocks the Mongoose model so
// no DB is required, matching the project's data-access-layer mocking convention.
describe('ProductRepository.findAll pagination', () => {
  afterEach(() => jest.restoreAllMocks());

  function mockCursor() {
    const cursor: any = {
      sort: jest.fn(() => cursor),
      skip: jest.fn(() => cursor),
      limit: jest.fn(() => cursor),
      exec: jest.fn(async () => []),
    };
    jest.spyOn(Product, 'find').mockReturnValue(cursor as never);
    return cursor;
  }

  it('applies skip/limit for page 2, limit 12', async () => {
    const cursor = mockCursor();
    await new ProductRepository().findAll({ page: '2', limit: '12' });
    expect(cursor.skip).toHaveBeenCalledWith(12);
    expect(cursor.limit).toHaveBeenCalledWith(12);
  });

  it('defaults to page 1 (skip 0) when page is omitted', async () => {
    const cursor = mockCursor();
    await new ProductRepository().findAll({ limit: '12' });
    expect(cursor.skip).toHaveBeenCalledWith(0);
    expect(cursor.limit).toHaveBeenCalledWith(12);
  });

  it('returns the full set (no skip/limit) when limit is absent', async () => {
    const cursor = mockCursor();
    await new ProductRepository().findAll({ category: 'Rings' });
    expect(cursor.skip).not.toHaveBeenCalled();
    expect(cursor.limit).not.toHaveBeenCalled();
  });

  it('ignores an invalid limit and returns the full set', async () => {
    const cursor = mockCursor();
    await new ProductRepository().findAll({ page: '1', limit: 'abc' });
    expect(cursor.skip).not.toHaveBeenCalled();
    expect(cursor.limit).not.toHaveBeenCalled();
  });

  it('caps an oversized limit at 100', async () => {
    const cursor = mockCursor();
    await new ProductRepository().findAll({ page: '3', limit: '1000' });
    // limit capped to 100, so page 3 ⇒ skip (3-1)*100 = 200
    expect(cursor.skip).toHaveBeenCalledWith(200);
    expect(cursor.limit).toHaveBeenCalledWith(100);
  });
});
