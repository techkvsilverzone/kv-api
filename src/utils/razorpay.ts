import crypto from 'crypto';
import https from 'https';
import { config } from '../config';
import { AppError } from './appError';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  [key: string]: unknown;
}

/**
 * Minimal Razorpay REST call using native https (no SDK dependency). Shared by product
 * checkout (`payment.service.ts`) and the savings-installment payment flow so the
 * security-critical order-creation/signature-verification logic exists in exactly one
 * place instead of being duplicated per feature.
 */
function callRazorpay(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<any> {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    throw new AppError('Razorpay credentials not configured', 500);
  }

  const payload = body ? JSON.stringify(body) : undefined;
  const auth = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.razorpay.com',
      path,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
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
    if (payload) req.write(payload);
    req.end();
  });
}

/** Create a Razorpay order for a server-computed amount (in paise). Never trust a client amount. */
export function createRazorpayOrder(amountPaise: number, currency: string, receipt: string): Promise<RazorpayOrder> {
  return callRazorpay('POST', '/v1/orders', { amount: amountPaise, currency, receipt });
}

/** Fetch a Razorpay order by id — used to re-confirm the amount actually captured. */
export function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder> {
  return callRazorpay('GET', `/v1/orders/${orderId}`);
}

/** HMAC-SHA256 signature check for a Razorpay `orderId|paymentId` pair. */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', config.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}
