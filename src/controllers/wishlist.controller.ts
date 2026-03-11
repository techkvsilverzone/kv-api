import { Response, NextFunction } from 'express';
import { WishlistService } from '../services/wishlist.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/appError';

export class WishlistController {
  private wishlistService: WishlistService;

  constructor() {
    this.wishlistService = new WishlistService();
  }

  public getWishlist = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const wishlist = await this.wishlistService.getWishlist(req.user!._id.toString());
      res.status(200).json(wishlist);
    } catch (error) {
      next(error);
    }
  };

  public addItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.body.productId) throw new AppError('productId is required', 400);
      const wishlist = await this.wishlistService.addItem(req.user!._id.toString(), String(req.body.productId));
      res.status(200).json(wishlist);
    } catch (error) {
      next(error);
    }
  };

  public removeItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const wishlist = await this.wishlistService.removeItem(
        req.user!._id.toString(),
        req.params.productId as string,
      );
      res.status(200).json(wishlist);
    } catch (error) {
      next(error);
    }
  };
}
