import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  public createOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.orderService.createOrder(req.user!._id.toString(), req.body);
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  };

  public getOrderById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.orderService.getOrderById(
        req.params.id as string,
        req.user!._id.toString(),
        req.user!.isAdmin,
      );
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  };

  public getMyOrders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await this.orderService.getUserOrders(req.user!._id.toString());
      res.status(200).json(orders);
    } catch (error) {
      next(error);
    }
  };

  public getAllOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await this.orderService.getAllOrders();
      res.status(200).json(orders);
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.orderService.updateOrderStatus(req.params.id as string, req.body.status);
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  };

  public getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.orderService.getAdminStats();
      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  };
}
