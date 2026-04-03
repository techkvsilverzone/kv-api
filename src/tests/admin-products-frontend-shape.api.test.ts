import request from 'supertest';
import app from '../app';
import { ProductService } from '../services/product.service';
import { ProductRepository } from '../repositories/product.repository';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (req: any, _res: unknown, next: () => void) => {
    req.user = { _id: { toString: () => 'admin123' }, name: 'Admin', isAdmin: true };
    next();
  },
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('POST /admin/products – frontend-shaped payload', () => {
  afterEach(() => jest.restoreAllMocks());

  const frontendPayload = {
    name: `E2E_PRODUCT_${Date.now()}`,
    price: 999,
    originalPrice: 1299,
    image: 'https://dummyimage.com/600x600/eee/333.jpg&text=E2E',
    category: 'Rings',
    weight: '2g',
    purity: '925',
    description: 'E2E smoke product',
    inStock: true,
  };

  /** Stub the repository so the full validateCreatePayload logic runs but no DB call is made */
  function stubRepo(captureRef?: { payload?: any }) {
    return jest
      .spyOn(ProductRepository.prototype, 'create')
      .mockImplementation(async (data: any) => {
        if (captureRef) captureRef.payload = data;
        return { _id: 'p99', ...data, images: [] } as never;
      });
  }

  it('accepts frontend-shaped payload without productGroupCode and returns 201', async () => {
    stubRepo();

    const response = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send(frontendPayload);

    expect(response.status).toBe(201);
    expect(response.body.name).toMatch(/E2E_PRODUCT/);
  });

  it('auto-generates productGroupCode when not supplied', async () => {
    const capture: { payload?: any } = {};
    stubRepo(capture);

    await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send(frontendPayload);

    expect(capture.payload.productGroupCode).toBeTruthy();
    expect(typeof capture.payload.productGroupCode).toBe('string');
  });

  it('parses weight string "2g" to numeric 2', async () => {
    const capture: { payload?: any } = {};
    stubRepo(capture);

    await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send(frontendPayload);

    expect(capture.payload.weight).toBe(2);
  });

  it('maps inStock:true to isActive:true', async () => {
    const capture: { payload?: any } = {};
    stubRepo(capture);

    await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send(frontendPayload);

    expect(capture.payload.isActive).toBe(true);
  });

  it('returns 400 for missing name', async () => {
    const response = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send({ price: 999, category: 'Rings', weight: 5 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('name');
  });

  it('returns 400 for negative price', async () => {
    const response = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Test', category: 'Rings', weight: 5, price: -1 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('price');
  });

  it('returns 400 for missing category', async () => {
    const response = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Test', weight: 5, price: 500 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('category');
  });
});

