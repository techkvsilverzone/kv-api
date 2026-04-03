import request from 'supertest';
import app from '../app';
import { OrderService } from '../services/order.service';
import { AppError } from '../utils/appError';

jest.mock('../middlewares/auth.middleware', () => ({
  protect: (req: any, _res: unknown, next: () => void) => {
    req.user = { _id: { toString: () => 'user123' }, name: 'Test User', isAdmin: false };
    next();
  },
  admin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const validOrderPayload = {
  items: [
    {
      product: '507f1f77bcf86cd799439011',
      name: 'Silver Ring',
      price: 1000,
      quantity: 1,
      image: 'https://dummyimage.com/100x100',
    },
  ],
  shippingAddress: {
    firstName: 'Smoke',
    lastName: 'User',
    address: '14 Rajaram Street',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600053',
    phone: '9999999999',
  },
  paymentMethod: 'COD',
  totalAmount: 1000,
};

describe('POST /orders', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates order with valid payload and uppercase COD paymentMethod', async () => {
    const createdOrder = {
      _id: 'order1',
      userId: 'user123',
      status: 'Pending',
      paymentMethod: 'cod',
      totalAmount: 1000,
      tax: 50,
      items: [{ productName: 'Silver Ring', quantity: 1 }],
      shippingAddress: { name: 'Smoke User', city: 'Chennai' },
      createdAt: new Date().toISOString(),
    };

    jest.spyOn(OrderService.prototype, 'createOrder').mockResolvedValue(createdOrder as never);

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', 'Bearer test-token')
      .send(validOrderPayload);

    expect(response.status).toBe(201);
    expect(response.body._id).toBe('order1');
  });

  it('creates order with lowercase cod paymentMethod', async () => {
    jest.spyOn(OrderService.prototype, 'createOrder').mockResolvedValue({
      _id: 'order2',
      paymentMethod: 'cod',
      totalAmount: 1000,
    } as never);

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', 'Bearer test-token')
      .send({ ...validOrderPayload, paymentMethod: 'cod' });

    expect(response.status).toBe(201);
  });

  it('returns 404 for GET /orders/me when user has no orders', async () => {
    jest.spyOn(OrderService.prototype, 'getUserOrders').mockRejectedValue(new AppError('No orders found', 404));

    const response = await request(app)
      .get('/api/v1/orders/me')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
  });
});
