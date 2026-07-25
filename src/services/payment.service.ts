import { OrderRepository } from '../repositories/order.repository';
import { CouponRepository } from '../repositories/coupon.repository';
import { UserRepository } from '../repositories/user.repository';
import { PricingService, CheckoutBreakdown, CheckoutItemInput, CheckoutAddress } from './pricing.service';
import { StockService } from './stock.service';
import { AppError } from '../utils/appError';
import { sendOrderConfirmationEmail, buildOrderConfirmationInput } from '../utils/emailNotifications';
import { sendPaymentSuccessMessage } from '../utils/whatsapp';
import { createRazorpayOrder, fetchRazorpayOrder, verifyRazorpaySignature } from '../utils/razorpay';
import Logger from '../utils/logger';

export interface CreateOrderInput {
  items: CheckoutItemInput[];
  couponCode?: string | null;
  // Shipping address drives the zone delivery charge; pincode kept for back-compat.
  shippingAddress?: CheckoutAddress | null;
  pincode?: string | null;
  currency?: string;
}

export class PaymentService {
  private orderRepository: OrderRepository;
  private couponRepository: CouponRepository;
  private userRepository: UserRepository;
  private pricingService: PricingService;
  private stockService: StockService;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.couponRepository = new CouponRepository();
    this.userRepository = new UserRepository();
    this.pricingService = new PricingService();
    this.stockService = new StockService();
  }

  /**
   * B2: Create a Razorpay order for an amount the SERVER computes from the cart
   * (DB prices x quantity + server tax + server-validated coupon + delivery).
   * The client-supplied amount is never trusted.
   */
  public async createRazorpayOrder(input: CreateOrderInput): Promise<any> {
    const breakdown = await this.pricingService.computeCheckout({
      items: input.items,
      couponCode: input.couponCode,
      address: input.shippingAddress,
      pincode: input.pincode,
    });

    if (breakdown.amountInPaise <= 0) {
      throw new AppError('Computed order amount is zero — nothing to charge', 400);
    }

    const razorpayOrder = await createRazorpayOrder(
      breakdown.amountInPaise,
      input.currency || 'INR',
      `rcpt_${breakdown.amountInPaise}_${breakdown.items.length}`,
    );

    return {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      // Authoritative breakdown for display; the client must not recompute it.
      breakdown: this.publicBreakdown(breakdown),
    };
  }

  /**
   * B2 + I9: Verify the Razorpay signature, RECOMPUTE the order total server-side,
   * confirm the amount actually charged matches, reserve stock atomically, and
   * persist server-computed totals. Any client price/total is ignored.
   */
  public async verifyAndCreateOrder(userId: string, payload: any): Promise<any> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderData } = payload;

    if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      throw new AppError('orderData.items is required', 400);
    }

    // Cash on Delivery has been discontinued — every order must be paid online.
    if (String(orderData?.paymentMethod || '').toLowerCase() === 'cod') {
      throw new AppError('Cash on Delivery is no longer available. Please pay online.', 400);
    }

    const isCod = false;

    if (!isCod && !verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      throw new AppError('Payment verification failed — signature mismatch', 400);
    }

    // Recompute the authoritative total from items + coupon + shipping address.
    const breakdown = await this.pricingService.computeCheckout({
      items: orderData.items,
      couponCode: orderData.couponCode,
      address: orderData.shippingAddress,
      pincode: orderData.shippingAddress?.pincode,
    });

    // For online payments, confirm the amount Razorpay actually captured equals
    // the freshly recomputed amount. Closes the price-tampering loop.
    if (!isCod) {
      const razorpayOrder = await fetchRazorpayOrder(razorpayOrderId);
      const chargedPaise = Number(razorpayOrder?.amount);
      if (chargedPaise !== breakdown.amountInPaise) {
        throw new AppError(
          'Payment amount does not match the server-computed order total',
          400,
        );
      }
    }

    // I9: reserve stock atomically before persisting the order.
    await this.stockService.reserveForOrder(breakdown.items, userId, 'Customer order');

    let order;
    try {
      order = await this.orderRepository.create({
        user: userId,
        items: breakdown.items,
        shippingAddress: orderData.shippingAddress,
        paymentMethod: orderData.paymentMethod,
        status: isCod ? 'Pending' : 'Processing',
        razorpayPaymentId: razorpayPaymentId || null,
        razorpayOrderId: razorpayOrderId || null,
        couponCode: breakdown.couponCode,
        couponDiscount: breakdown.discount,
        giftWrap: orderData.giftWrap || false,
        giftMessage: orderData.giftMessage || null,
        giftWrapFee: orderData.giftWrapFee || 0,
        subtotal: breakdown.subtotal,
        taxAmount: breakdown.taxAmount,
        totalWithTax: Math.round((breakdown.subtotal + breakdown.taxAmount) * 100) / 100,
        deliveryFee: breakdown.deliveryFee,
        grandTotal: breakdown.grandTotal,
        totalAmount: breakdown.grandTotal,
        tax: breakdown.taxAmount,
      });
    } catch (error) {
      // Compensate: order persistence failed after stock was reserved.
      await this.stockService.releaseForOrder(breakdown.items, userId);
      throw error;
    }

    // Increment coupon usage only after the order is persisted.
    if (breakdown.couponCode) {
      const coupon = await this.couponRepository.findByCode(breakdown.couponCode);
      if (coupon) {
        await this.couponRepository.incrementUsedCount(coupon._id);
      }
    }

    // Send the order confirmation email for BOTH razorpay and COD (best-effort).
    try {
      const user = await this.userRepository.findById(userId);
      await sendOrderConfirmationEmail(
        buildOrderConfirmationInput(order, { userEmail: user?.email, userName: user?.name }),
      );
    } catch (error) {
      Logger.error(`Order confirmation email dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // WhatsApp payment-success confirmation (best-effort, mirrors the email above).
    try {
      const phone = order.shippingAddress?.phone;
      if (phone) {
        await sendPaymentSuccessMessage(phone, {
          invoiceNumber: order.invoiceNumber,
          amount: order.grandTotal || order.totalAmount,
          paymentMethod: order.paymentMethod,
        });
      }
    } catch (error) {
      Logger.error(`Order confirmation WhatsApp dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return order;
  }

  private publicBreakdown(breakdown: CheckoutBreakdown) {
    return {
      items: breakdown.items.map((i) => ({
        product: i.product,
        name: i.name,
        quantity: i.quantity,
        weight: i.weight,
        unitPrice: i.price,
        totalPrice: i.totalPrice,
        metalValue: i.metalValue,
        makingCharge: i.makingCharge,
        wastage: i.wastage,
        isGiftVoucher: i.isGiftVoucher,
      })),
      subtotal: breakdown.subtotal,
      taxableSubtotal: breakdown.taxableSubtotal,
      discount: breakdown.discount,
      couponCode: breakdown.couponCode,
      gstPercent: breakdown.gstPercent,
      taxAmount: breakdown.taxAmount,
      deliveryZone: breakdown.deliveryZone,
      deliveryFee: breakdown.deliveryFee,
      grandTotal: breakdown.grandTotal,
    };
  }
}
