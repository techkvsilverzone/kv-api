import request from 'supertest';
import app from '../app';
import { disconnectPostgres } from '../infrastructure/postgres/pool';
import { UserRepository } from '../repositories/user.repository';

/**
 * End-to-end API checks against a REAL PostgreSQL database (spec §35, §37).
 *
 * Opt-in: skipped unless `RUN_DB_TESTS=1` and `POSTGRES_URL` are both set, so
 * `npm test` stays hermetic. Run it against a reachable database with:
 *
 *   RUN_DB_TESTS=1 npx jest src/tests/live-postgres.integration.test.ts --runInBand
 *
 * Every case here is READ-ONLY. Nothing writes, so it is safe to point at the
 * production database during cutover validation.
 */
const shouldRun = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.POSTGRES_URL);
const describeLive = shouldRun ? describe : describe.skip;

describeLive('API endpoints against live PostgreSQL', () => {
  afterAll(async () => {
    await disconnectPostgres();
  });

  it('GET /api/v1/health reports UP with a working database', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /api/v1/products returns an array of products', async () => {
    const res = await request(app).get('/api/v1/products');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/products honours pagination', async () => {
    const res = await request(app).get('/api/v1/products?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(2);
  });

  it('a product carries its nested variants, images and pricing', async () => {
    const list = await request(app).get('/api/v1/products?limit=1');
    if (!list.body.length) return; // empty catalogue — nothing to assert

    const res = await request(app).get(`/api/v1/products/${list.body[0]._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('_id');
    expect(Array.isArray(res.body.images)).toBe(true);
    expect(Array.isArray(res.body.variants)).toBe(true);
    // Stock is enriched from the inventory table.
    expect(res.body).toHaveProperty('stockAvailable');

    // Images must be URLs from product_images.image_url — never base64 (spec §13, §36).
    for (const image of res.body.images) {
      expect(image.imageUrl).toMatch(/^(https?:\/\/|\/)/);
      expect(image.imageBase64).toBe(image.imageUrl);
      expect(image.imageBase64).not.toMatch(/^data:/);
    }
  });

  it('GET /api/v1/products/:id returns 404 for a legacy Mongo ObjectId', async () => {
    // Old links must 404, not 500 with a bigint cast error.
    const res = await request(app).get('/api/v1/products/69b15096631b43ff2de76aa2');
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/products/categories returns the category tree', async () => {
    const res = await request(app).get('/api/v1/products/categories');

    expect(res.status).toBe(200);
    const categories = Array.isArray(res.body) ? res.body : res.body.data;
    expect(Array.isArray(categories)).toBe(true);
  });

  it('serves the public configuration endpoints', async () => {
    for (const path of ['/api/v1/store-config', '/api/v1/pricing-config', '/api/v1/delivery-config']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get(path);
      expect([200, 304]).toContain(res.status);
    }
  });

  it('serves the public rate endpoints', async () => {
    for (const path of ['/api/v1/metal-rates', '/api/v1/silver-rates/today', '/api/v1/gold-rates/today']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get(path);
      expect(res.status).toBeLessThan(500);
    }
  });

  it('rejects invalid credentials with 401, not a server error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@kvsilverzone.com', password: 'definitely-not-the-password' });

    expect(res.status).toBe(401);
  });

  it('reads the seeded admin account out of PostgreSQL with its bcrypt hash intact', async () => {
    // Password hashes were migrated verbatim and must still be bcrypt (spec §11).
    const admin = await new UserRepository().findByEmail('admin@kvsilverzone.com');

    if (!admin) return; // account not present in this environment
    expect(admin.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(admin._id).toMatch(/^\d+$/);
  });

  it('requires authentication on a protected route', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });
});
