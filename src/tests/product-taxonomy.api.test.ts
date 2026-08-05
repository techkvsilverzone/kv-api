import request from 'supertest';
import app from '../app';
import { ProductRepository } from '../repositories/product.repository';
import { CategoryRepository } from '../repositories/category.repository';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (req: any, _res: unknown, next: () => void) => {
    req.user = { _id: { toString: () => 'admin123' }, name: 'Admin', isAdmin: true };
    next();
  },
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
  adminOrStaff: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('Product taxonomy, tags, and fixed-price weight rules', () => {
  afterEach(() => jest.restoreAllMocks());

  /** Stub the repository so the full validateCreatePayload logic runs but no DB write happens. */
  function stubRepo(captureRef?: { payload?: any }) {
    return jest
      .spyOn(ProductRepository.prototype, 'create')
      .mockImplementation(async (data: any) => {
        if (captureRef) captureRef.payload = data;
        return { _id: 'p1', ...data, images: [] } as never;
      });
  }

  function stubCategories(tree: Array<{ name: string; parent: string | null }>) {
    return jest.spyOn(CategoryRepository.prototype, 'findAll').mockResolvedValue(tree as never);
  }

  describe('fixed-price weight rules', () => {
    it('accepts a fixed-price product with no weight', async () => {
      const capture: { payload?: any } = {};
      stubRepo(capture);

      const response = await request(app).post('/api/v1/admin/products').send({
        name: 'Gift Voucher Coin',
        category: 'Coins',
        isFixedPrice: true,
        price: 500,
      });

      expect(response.status).toBe(201);
      expect(capture.payload.weight).toBe(0);
    });

    it('rejects a dynamic-priced product with no weight', async () => {
      const response = await request(app).post('/api/v1/admin/products').send({
        name: 'Silver Ring',
        category: 'Jewellery',
        price: 0,
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('weight');
    });

    it('rejects a negative weight even for a fixed-price product', async () => {
      const response = await request(app).post('/api/v1/admin/products').send({
        name: 'Gift Voucher Coin',
        category: 'Coins',
        isFixedPrice: true,
        price: 500,
        weight: -5,
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('weight');
    });
  });

  describe('category/subcategory', () => {
    it('accepts a category with no subcategory', async () => {
      const capture: { payload?: any } = {};
      stubRepo(capture);

      const response = await request(app).post('/api/v1/admin/products').send({
        name: 'Ganesha Idol',
        category: 'Idols',
        isFixedPrice: true,
        price: 2000,
      });

      expect(response.status).toBe(201);
      expect(capture.payload.category).toBe('Idols');
      expect(capture.payload.subcategory).toBe('');
    });

    it('accepts a subcategory registered under its parent category', async () => {
      stubCategories([{ name: 'Jewellery', parent: null }, { name: 'Mens', parent: 'Jewellery' }]);
      const capture: { payload?: any } = {};
      stubRepo(capture);

      const response = await request(app).post('/api/v1/admin/products').send({
        name: "Men's Chain",
        category: 'Jewellery',
        subcategory: 'Mens',
        weight: 20,
        price: 0,
      });

      expect(response.status).toBe(201);
      expect(capture.payload.subcategory).toBe('Mens');
    });

    it('rejects a subcategory not registered under the given category', async () => {
      stubCategories([{ name: 'Jewellery', parent: null }, { name: 'Mens', parent: 'Jewellery' }]);

      const response = await request(app).post('/api/v1/admin/products').send({
        name: 'Mismatched Product',
        category: 'Coins',
        subcategory: 'Mens',
        isFixedPrice: true,
        price: 500,
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('subcategory');
    });
  });

  describe('tags', () => {
    it('normalizes a comma-separated tags string, trimming and de-duplicating case-insensitively', async () => {
      const capture: { payload?: any } = {};
      stubRepo(capture);

      const response = await request(app).post('/api/v1/admin/products').send({
        name: 'Tagged Product',
        category: 'Coins',
        isFixedPrice: true,
        price: 500,
        tags: ' Gifting , bestseller, Gifting ,  ',
      });

      expect(response.status).toBe(201);
      expect(capture.payload.tags).toEqual(['Gifting', 'bestseller']);
    });

    it('accepts a tags array directly', async () => {
      const capture: { payload?: any } = {};
      stubRepo(capture);

      const response = await request(app).post('/api/v1/admin/products').send({
        name: 'Tagged Product',
        category: 'Coins',
        isFixedPrice: true,
        price: 500,
        tags: ['new', 'trending'],
      });

      expect(response.status).toBe(201);
      expect(capture.payload.tags).toEqual(['new', 'trending']);
    });

    it('defaults to an empty tags array when omitted', async () => {
      const capture: { payload?: any } = {};
      stubRepo(capture);

      const response = await request(app).post('/api/v1/admin/products').send({
        name: 'Untagged Product',
        category: 'Coins',
        isFixedPrice: true,
        price: 500,
      });

      expect(response.status).toBe(201);
      expect(capture.payload.tags).toEqual([]);
    });
  });

  describe('GET /products/categories', () => {
    it('returns a category tree merging registered and in-use categories', async () => {
      stubCategories([{ name: 'Jewellery', parent: null }, { name: 'Mens', parent: 'Jewellery' }]);
      jest.spyOn(ProductRepository.prototype, 'getCategoryUsage').mockResolvedValue([{ category: 'Coins' }] as never);

      const response = await request(app).get('/api/v1/products/categories');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([
        { name: 'Coins', subcategories: [] },
        { name: 'Jewellery', subcategories: ['Mens'] },
      ]);
    });
  });
});
