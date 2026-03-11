import crypto from 'crypto';
import https from 'https';
import { config } from '../config';
import { OrderRepository } from '../repositories/order.repository';
import { CouponRepository } from '../repositories/coupon.repository';
import { AppError } from '../utils/appError';

export class PaymentService {
  private orderRepository: OrderRepository;
  private couponRepository: CouponRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.couponRepository = new CouponRepository();
  }

  public async createRazorpayOrder(amount: number, currency = 'INR'): Promise<any> {
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      throw new AppError('Razorpay credentials not configured', 500);
    }

    const receipt = `rcpt_${Date.now()}`;
    const body = JSON.stringify({ amount, currency, receipt });
    const auth = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');

    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: 'api.razorpay.com',
        path: '/v1/orders',
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new AppError(parsed.error?.description || 'Razorpay API error', res.statusCode));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new AppError('Invalid response from Razorpay', 502));
          }
        });
      });

      req.on('error', () => reject(new AppError('Failed to connect to Razorpay', 502)));
      req.write(body);
      req.end();
    });
  }

  public async verifyAndCreateOrder(userId: string, payload: any): Promise<any> {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      orderData,
    } = payload;

    const isCod =
      !razorpayOrderId &&
      !razorpayPaymentId &&
      !razorpaySignature &&
      orderData?.paymentMethod === 'cod';

    if (!isCod) {
      // Verify Razorpay signature
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpayKeySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        throw new AppError('Payment verification failed — signature mismatch', 400);
      }
    }

    const orderToCreate = {
      user: userId,
      items: orderData.items,
      shippingAddress: orderData.shippingAddress,
      paymentMethod: orderData.paymentMethod,
      totalAmount: orderData.totalAmount,
      tax: orderData.totalAmount * 0.05,
      status: isCod ? 'Pending' : 'Processing',
      razorpayPaymentId: razorpayPaymentId || null,
      couponCode: orderData.couponCode || null,
      couponDiscount: orderData.couponDiscount || 0,
    };

    const order = await this.orderRepository.create(orderToCreate);

    // Increment coupon usage if applied
    if (orderData.couponCode) {
      const coupon = await this.couponRepository.findByCode(orderData.couponCode);
      if (coupon) {
        await this.couponRepository.incrementUsedCount(coupon._id);
      }
    }

    return order;
  }
}
