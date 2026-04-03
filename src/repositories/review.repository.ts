import mongoose from 'mongoose';
import { Review } from '../models/review.model';

export interface IReview {
  _id: string;
  productId: string;
  userId: string;
  userName?: string;
  rating: number;
  title?: string;
  comment?: string;
  createdAt: Date;
}

export class ReviewRepository {
  public async findByProductId(productId: string): Promise<IReview[]> {
    if (!mongoose.Types.ObjectId.isValid(productId)) return [];

    const reviews = await Review.find({ productId: new mongoose.Types.ObjectId(productId) })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .exec();

    return reviews.map((r) => ({
      _id: r._id.toString(),
      productId: r.productId.toString(),
      userId: r.userId.toString(),
      userName: (r.userId as any)?.name,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    }));
  }

  public async create(data: Partial<IReview>): Promise<IReview> {
    const review = new Review({
      productId: new mongoose.Types.ObjectId(String(data.productId)),
      userId: new mongoose.Types.ObjectId(String(data.userId)),
      rating: Number(data.rating || 5),
      comment: data.comment,
    });

    const saved = await review.save();
    const populated = await saved.populate('userId', 'name');

    return {
      _id: saved._id.toString(),
      productId: saved.productId.toString(),
      userId: saved.userId.toString(),
      userName: (populated.userId as any)?.name,
      rating: saved.rating,
      comment: saved.comment,
      createdAt: saved.createdAt,
    };
  }

  public async deleteById(reviewId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) return false;
    const result = await Review.findByIdAndDelete(reviewId).exec();
    return result !== null;
  }

  public async findById(reviewId: string): Promise<{ userId: string } | null> {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) return null;
    const review = await Review.findById(reviewId).exec();
    if (!review) return null;
    return { userId: review.userId.toString() };
  }

  public async getAverageRating(productId: string): Promise<{ averageRating: number; totalReviews: number }> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return { averageRating: 0, totalReviews: 0 };
    }

    const result = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    return {
      averageRating: result[0]?.averageRating
        ? Number(result[0].averageRating.toFixed(1))
        : 0,
      totalReviews: result[0]?.totalReviews || 0,
    };
  }
}
