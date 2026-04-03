import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/appError';
import { sendOrderCreatedEmails } from '../utils/emailNotifications';
import Logger from '../utils/logger';

export class OrderService {
  private orderRepository: OrderRepository;
  private productRepository: ProductRepository;
  private userRepository: UserRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
  }

  public async createOrder(userId: string, data: any) {
    // In a real app, you'd validate prices and stock here
    const orderData = {
      user: userId,
      ...data,
      tax: data.totalAmount * 0.05, // Example 5% tax
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
