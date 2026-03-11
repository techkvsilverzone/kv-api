import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { AppError } from '../utils/appError';

export class OrderService {
  private orderRepository: OrderRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
  }

  public async createOrder(userId: string, data: any) {
    // In a real app, you'd validate prices and stock here
    const orderData = {
      user: userId,
      ...data,
      tax: data.totalAmount * 0.05, // Example 5% tax
    };
    return await this.orderRepository.create(orderData);
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
