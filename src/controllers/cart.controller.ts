import { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cart.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class CartController {
  private cartService: CartService;

  constructor() {
    this.cartService = new CartService();
  }

  public getCart = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cart = await this.cartService.getCart(req.user!._id.toString());
      res.status(200).json(cart || { items: [] });
    } catch (error) {
      next(error);
    }
  };

  public updateCartItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId, quantity } = req.body;
      const cart = await this.cartService.updateCart(req.user!._id.toString(), productId, quantity);
      res.status(200).json(cart);
    } catch (error) {
      next(error);
    }
  };

  public removeCartItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cart = await this.cartService.removeItem(req.user!._id.toString(), req.params.id as string);
      res.status(200).json(cart);
    } catch (error) {
      next(error);
    }
  };
}
