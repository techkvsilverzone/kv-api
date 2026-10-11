import { OrderRepository } from '../repositories/order.repository';
import { UserRepository } from '../repositories/user.repository';
import { PricingService, type CheckoutBreakdown, type CheckoutItemInput } from './pricing.service';
import { StockService } from './stock.service';
import { AppError } from '../utils/appError';
import { isIndianMobile, toIndianMobile } from '../utils/phone';

export const OFFLINE_PAYMENT_METHODS = ['cash', 'upi', 'card'] as const;

interface OfflineSaleInput {
  items?: CheckoutItemInput[];
  couponCode?: string | null;
  paymentMethod?: string;
  saleLocation?: string | null;
  customer?: { name?: string; phone?: string; address?: string } | null;
}

/**
 * In-store / stall billing by admin or staff. Priced, stock-checked and invoiced exactly like an
 * online order (same pricing, same stock reservation and inventory ledger, same invoice series),
 * but recorded with channel OFFLINE, already Paid and Delivered, with no delivery fee.
 */
export class OfflineSaleService {
  private orderRepository = new OrderRepository();
  private userRepository = new UserRepository();
  private pricingService = new PricingService();
  private stockService = new StockService();

  /** Authoritative totals for the counter screen, before the sale is confirmed. */
  public async quote(input: OfflineSaleInput) {
    return this.shape(await this.price(input));
  }

  public async create(staffId: string, input: OfflineSaleInput) {
    const paymentMethod = String(input.paymentMethod || '').toLowerCase();
    if (!(OFFLINE_PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
      throw new AppError(`paymentMethod must be one of ${OFFLINE_PAYMENT_METHODS.join(', ')}`, 400);
    }

    const name = String(input.customer?.name ?? '').trim().slice(0, 200);
    const phone = input.customer?.phone ? toIndianMobile(input.customer.phone) : '';
    if (phone && !isIndianMobile(phone)) {
      throw new AppError('Customer mobile must be a valid 10-digit Indian mobile number', 400);
    }
    // A known mobile links the sale to that customer's account, so it shows in their order history.
    const customer = phone ? await this.userRepository.findByPhone(phone) : null;
    const saleLocation = String(input.saleLocation ?? '').trim();

    const breakdown = await this.price(input);
    await this.stockService.reserveForOrder(
      breakdown.items,
      staffId,
      saleLocation ? `Offline sale — ${saleLocation}` : 'Offline sale',
    );

    try {
      const order = await this.orderRepository.create({
        channel: 'OFFLINE',
        user: customer?._id ?? null,
        soldBy: staffId,
        saleLocation: saleLocation || null,
        items: breakdown.items,
        shippingAddress: {
          name: name || customer?.name || 'Walk-in customer',
          phone,
          line1: String(input.customer?.address ?? '').trim(),
          city: '',
          state: '',
          pincode: '',
        },
        paymentMethod,
        paymentStatus: 'Paid',
        status: 'Delivered',
        couponCode: breakdown.couponCode,
        couponDiscount: breakdown.discount,
        subtotal: breakdown.subtotal,
        taxAmount: breakdown.taxAmount,
        totalWithTax: Math.round((breakdown.subtotal + breakdown.taxAmount) * 100) / 100,
        deliveryFee: 0,
        grandTotal: breakdown.grandTotal,
        totalAmount: breakdown.grandTotal,
        tax: breakdown.taxAmount,
      });
      // Re-read with the joins so the response carries the seller's name for the invoice.
      return (await this.orderRepository.findById(order._id)) ?? order;
    } catch (error) {
      await this.stockService.releaseForOrder(breakdown.items, staffId);
      throw error;
    }
  }

  private async price(input: OfflineSaleInput): Promise<CheckoutBreakdown> {
    const items = Array.isArray(input.items) ? input.items : [];
    if (items.length === 0) throw new AppError('Add at least one product', 400);
    if (items.some((i) => i.isGiftVoucher || i.giftVoucherId)) {
      throw new AppError('Gift vouchers cannot be sold through in-store billing', 400);
    }
    // No address: an in-store sale has no delivery fee.
    return this.pricingService.computeCheckout({ items, couponCode: input.couponCode || null, address: null });
  }

  private shape(b: CheckoutBreakdown) {
    return {
      items: b.items.map((i) => ({
        product: i.product,
        name: i.name,
        quantity: i.quantity,
        weight: i.weight,
        unitPrice: i.price,
        totalPrice: i.totalPrice,
      })),
      subtotal: b.subtotal,
      discount: b.discount,
      couponCode: b.couponCode,
      gstPercent: b.gstPercent,
      taxAmount: b.taxAmount,
      grandTotal: b.grandTotal,
    };
  }
}
