import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { InventoryService } from '../services/inventory.service';
import { AppError } from '../utils/appError';

export class InventoryController {
  private inventoryService: InventoryService;

  constructor() {
    this.inventoryService = new InventoryService();
    this.inward = this.inward.bind(this);
    this.outward = this.outward.bind(this);
    this.getTransactions = this.getTransactions.bind(this);
    this.reconcile = this.reconcile.bind(this);
    this.getLowStock = this.getLowStock.bind(this);
    this.getSummary = this.getSummary.bind(this);
  }

  public async inward(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, quantity, reason } = req.body;
      const performedBy = String(req.user!._id);

      if (!productId || quantity === undefined || !reason) {
        return next(new AppError('productId, quantity, and reason are required', 400));
      }
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        return next(new AppError('quantity must be a positive integer', 400));
      }

      const transaction = await this.inventoryService.stockInward(
        String(productId),
        qty,
        String(reason),
        performedBy,
      );

      res.status(201).json({
        success: true,
        message: 'Stock inward recorded successfully',
        transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  public async outward(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, quantity, reason } = req.body;
      const performedBy = String(req.user!._id);

      if (!productId || quantity === undefined || !reason) {
        return next(new AppError('productId, quantity, and reason are required', 400));
      }
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        return next(new AppError('quantity must be a positive integer', 400));
      }

      const transaction = await this.inventoryService.stockOutward(
        String(productId),
        qty,
        String(reason),
        performedBy,
      );

      res.status(201).json({
        success: true,
        message: 'Stock outward recorded successfully',
        transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, type, limit } = req.query;

      const filters: any = {};
      if (productId) filters.productId = String(productId);
      if (type === 'IN' || type === 'OUT') filters.type = type;
      if (limit) filters.limit = Number(limit);

      const transactions = await this.inventoryService.getTransactions(filters);

      res.status(200).json({
        success: true,
        transactions,
      });
    } catch (error) {
      next(error);
    }
  }

  public async reconcile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, physicalCount, reason } = req.body;
      const performedBy = String(req.user!._id);

      if (!productId || physicalCount === undefined || !reason) {
        return next(new AppError('productId, physicalCount, and reason are required', 400));
      }
      const count = Number(physicalCount);
      if (!Number.isInteger(count) || count < 0) {
        return next(new AppError('physicalCount must be a non-negative integer', 400));
      }

      const result = await this.inventoryService.reconcile(
        String(productId),
        count,
        String(reason),
        performedBy,
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getLowStock(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const lowStockItems = await this.inventoryService.getLowStock();

      res.status(200).json({
        success: true,
        lowStockItems,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await this.inventoryService.getSummary();

      res.status(200).json({
        success: true,
        ...summary,
      });
    } catch (error) {
      next(error);
    }
  }
}
