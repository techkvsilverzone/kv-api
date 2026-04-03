import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../services/review.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class ReviewController {
  private reviewService: ReviewService;

  constructor() {
    this.reviewService = new ReviewService();
  }

  public getProductReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.reviewService.getProductReviews(req.params.productId as string);
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  };

  public createReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const review = await this.reviewService.createReview(
        req.user!._id.toString(),
        req.params.productId as string,
        req.body,
      );
      res.status(201).json(review);
    } catch (error) {
      next(error);
    }
  };

  public deleteReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.reviewService.deleteReview(
        req.params.reviewId as string,
        req.user!._id.toString(),
        Boolean(req.user?.isAdmin),
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
