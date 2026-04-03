import request from 'supertest';
import app from '../app';
import { ProductService } from '../services/product.service';
import { AppError } from '../utils/appError';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (_req: unknown, _res: unknown, next: () => void) => next(),
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('Admin Products API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POST /api/v1/admin/products creates product with valid payload', async () => {
    const created = {
      _id: 'p1',
      productGroupCode: 'P1001',
      name: 'Ring',
      material: 'Silver',
      weight: 10,
      price: 1000,
      quantity: 2,
      images: [],
    };

    jest.spyOn(ProductService.prototype, 'createProduct').mockResolvedValue(created as never);

    const response = await request(app).post('/api/v1/admin/products').send({
      productGroupCode: 'P1001',
      name: 'Ring',
      category: 'Silver',
      weightGm: 10,
      price: 1000,
      quantity: 2,
    });

    expect(response.status).toBe(201);
    expect(response.body.productGroupCode).toBe('P1001');
  });

  it('POST /api/v1/admin/products returns 400 for invalid payload', async () => {
    const response = await request(app).post('/api/v1/admin/products').send({
      productGroupCode: 'P1001',
      name: 'Ring',
      category: 'Silver',
      weightGm: 8,
      price: -10,
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('price');
  });

  it('PUT /api/v1/admin/products/:id updates an existing product', async () => {
    const updated = {
      _id: 'p1',
      productGroupCode: 'P1001',
      name: 'Ring Updated',
      material: 'Silver',
      weight: 11,
      price: 1200,
      quantity: 3,
      images: [],
    };

    jest.spyOn(ProductService.prototype, 'updateProduct').mockResolvedValue(updated as never);

    const response = await request(app).put('/api/v1/admin/products/p1').send({
      name: 'Ring Updated',
      price: 1200,
      quantity: 3,
    });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Ring Updated');
  });

  it('PUT /api/v1/admin/products/:id returns 404 when product does not exist', async () => {
    const notFoundError = new AppError('Product not found', 404);
    jest.spyOn(ProductService.prototype, 'updateProduct').mockRejectedValue(notFoundError);

    const response = await request(app).put('/api/v1/admin/products/unknown').send({
      name: 'Ring Updated',
    });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Product not found');
  });

  it('DELETE /api/v1/admin/products/:id deletes an existing product', async () => {
    jest.spyOn(ProductService.prototype, 'deleteProduct').mockResolvedValue({ _id: 'p1' } as never);

    const response = await request(app).delete('/api/v1/admin/products/p1');

    expect(response.status).toBe(204);
  });

  it('DELETE /api/v1/admin/products/:id returns 404 when product does not exist', async () => {
    const notFoundError = new AppError('Product not found', 404);
    jest.spyOn(ProductService.prototype, 'deleteProduct').mockRejectedValue(notFoundError);

    const response = await request(app).delete('/api/v1/admin/products/unknown');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Product not found');
  });

  it('Error contract: validation failures should not return raw 500', async () => {
    const response = await request(app).post('/api/v1/admin/products').send({
      productGroupCode: 'P1002',
      category: 'Silver',
      price: 1000,
      weightGm: 5,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(response.body).toHaveProperty('message');
  });
});
