import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { UserRepository } from '../repositories/user.repository';
import { PricingService } from './pricing.service';
import { StockService } from './stock.service';
import { AppError } from '../utils/appError';
import { sendOrderConfirmationEmail, buildOrderConfirmationInput } from '../utils/emailNotifications';
import Logger from '../utils/logger';

// Minimum seconds between confirmation-email resends for the same order.
const RESEND_COOLDOWN_MS = 60_000;

export class OrderService {
  private orderRepository: OrderRepository;
  private productRepository: ProductRepository;
  private userRepository: UserRepository;
  private pricingService: PricingService;
  private stockService: StockService;
  // In-memory resend throttle (orderId -> last sent ms). Per-instance.
  private resendCooldown = new Map<string, number>();

  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
    this.pricingService = new PricingService();
    this.stockService = new StockService();
  }

  public async createOrder(userId: string, data: any) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new AppError('items is required', 400);
    }

    // B2/B3: prices, tax, coupon and delivery are all computed server-side.
    const breakdown = await this.pricingService.computeCheckout({
      items: data.items,
      couponCode: data.couponCode,
      address: data.shippingAddress,
      pincode: data.shippingAddress?.pincode,
    });

    // I9: reserve stock atomically before persisting.
    await this.stockService.reserveForOrder(breakdown.items, userId, 'Customer order');

    let order;
    try {
      order = await this.orderRepository.create({
        user: userId,
        items: breakdown.items,
        shippingAddress: data.shippingAddress,
        paymentMethod: data.paymentMethod || 'cod',
        status: data.status || 'Pending',
        couponCode: breakdown.couponCode,
        couponDiscount: breakdown.discount,
        giftWrap: data.giftWrap || false,
        giftMessage: data.giftMessage || null,
        giftWrapFee: data.giftWrapFee || 0,
        subtotal: breakdown.subtotal,
        taxAmount: breakdown.taxAmount,
        totalWithTax: Math.round((breakdown.subtotal + breakdown.taxAmount) * 100) / 100,
        deliveryFee: breakdown.deliveryFee,
        grandTotal: breakdown.grandTotal,
        totalAmount: breakdown.grandTotal,
        tax: breakdown.taxAmount,
      });
    } catch (error) {
      await this.stockService.releaseForOrder(breakdown.items, userId);
      throw error;
    }

    try {
      const user = await this.userRepository.findById(userId);
      await sendOrderConfirmationEmail(
        buildOrderConfirmationInput(order, { userEmail: user?.email, userName: user?.name }),
      );
    } catch (error) {
      Logger.error(`Order creation email dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return order;
  }

  public async getOrderById(orderId: string, userId: string, isAdmin = false) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    // userId is populated to a { _id, name, email } doc by the repository, so
    // resolve the owner id from either the populated doc or a raw ObjectId.
    const ownerId = (order.userId as any)?._id?.toString?.() ?? (order.userId as any)?.toString?.();
    if (!isAdmin && ownerId !== userId) throw new AppError('Not authorised', 403);
    return order;
  }

  public async getUserOrders(userId: string) {
    return await this.orderRepository.findByUserId(userId);
  }

  /**
   * Re-send the order confirmation email to the order owner. Authorised for the
   * owner or an admin; throttled per-order to prevent abuse.
   */
  public async resendConfirmation(orderId: string, userId: string, isAdmin = false) {
    // getOrderById enforces ownership/admin and throws 404/403 as needed.
    const order = await this.getOrderById(orderId, userId, isAdmin);

    const last = this.resendCooldown.get(orderId);
    if (last && Date.now() - last < RESEND_COOLDOWN_MS) {
      throw new AppError('A confirmation email was just sent. Please wait a moment before resending.', 429);
    }

    const populated = order.userId as any;
    let userEmail: string | undefined = populated?.email;
    let userName: string | undefined = populated?.name;
    if (!userEmail) {
      const owner = await this.userRepository.findById(String(populated?._id ?? populated ?? ''));
      userEmail = owner?.email;
      userName = owner?.name;
    }

    if (!userEmail) {
      throw new AppError('No email on file for this order', 400);
    }

    await sendOrderConfirmationEmail(buildOrderConfirmationInput(order, { userEmail, userName }));
    this.resendCooldown.set(orderId, Date.now());
    return { success: true, message: 'Confirmation email sent' };
  }

  public async getAllOrders() {
    return await this.orderRepository.findAll();
  }

  public async updateOrderStatus(orderId: string, status: string) {
    const order = await this.orderRepository.updateStatus(orderId, status);
    if (!order) throw new AppError('Order not found', 404);
    return order;
  }

  public async getAdminStats() {
    const orderStats = await this.orderRepository.getStats();
    const totalProducts = await this.productRepository.count();
    // Simplified stats
    return {
      ...orderStats,
      totalProducts,
    };
  }
}
