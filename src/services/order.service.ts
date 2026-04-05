import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { UserRepository } from '../repositories/user.repository';
import { PincodeRateRepository } from '../repositories/pincodeRate.repository';
import { AppError } from '../utils/appError';
import { sendOrderCreatedEmails } from '../utils/emailNotifications';
import Logger from '../utils/logger';

export class OrderService {
  private orderRepository: OrderRepository;
  private productRepository: ProductRepository;
  private userRepository: UserRepository;
  private pincodeRateRepository: PincodeRateRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
    this.pincodeRateRepository = new PincodeRateRepository();
  }

  public async createOrder(userId: string, data: any) {
    const items: any[] = data.items || [];

    // Compute subtotal from non-gift-voucher items
    const subtotal = items.reduce((sum: number, item: any) => {
      if (item.isGiftVoucher) return sum;
      return sum + Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1);
    }, 0);

    const taxAmount = Math.round(subtotal * 0.03 * 100) / 100; // GST 3%
    const totalWithTax = Math.round((subtotal + taxAmount) * 100) / 100;

    // Look up delivery fee from pincode table
    const pincode = data.shippingAddress?.pincode;
    let deliveryFee = Number(data.deliveryFee || 0);
    if (pincode) {
      const pincodeRate = await this.pincodeRateRepository.findByPincode(String(pincode));
      if (pincodeRate) deliveryFee = pincodeRate.rate;
    }

    const grandTotal = Math.round((totalWithTax + deliveryFee) * 100) / 100;

    const orderData = {
      user: userId,
      ...data,
      subtotal,
      taxAmount,
      totalWithTax,
      deliveryFee,
      grandTotal,
      totalAmount: grandTotal,
      tax: taxAmount,
    };
    const order = await this.orderRepository.create(orderData);

    try {
      const user = await this.userRepository.findById(userId);
      await sendOrderCreatedEmails({
        userEmail: user?.email,
        userName: user?.name,
        orderId: order._id.toString(),
        totalAmount: Number(order.totalAmount || data.totalAmount || 0),
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
      });
    } catch (error) {
      Logger.error(`Order creation email dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return order;
  }

  public async getOrderById(orderId: string, userId: string, isAdmin = false) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (!isAdmin && order.userId.toString() !== userId) throw new AppError('Not authorised', 403);
    return order;
  }

  public async getUserOrders(userId: string) {
    return await this.orderRepository.findByUserId(userId);
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
