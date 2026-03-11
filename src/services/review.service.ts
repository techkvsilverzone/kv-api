import { ReviewRepository } from '../repositories/review.repository';
import { ProductRepository } from '../repositories/product.repository';
import { AppError } from '../utils/appError';

export class ReviewService {
  private reviewRepository: ReviewRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.reviewRepository = new ReviewRepository();
    this.productRepository = new ProductRepository();
  }

  public async getProductReviews(productId: string) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    const [reviews, summary] = await Promise.all([
      this.reviewRepository.findByProductId(productId),
      this.reviewRepository.getAverageRating(productId),
    ]);

    return { ...summary, reviews };
  }

  public async createReview(userId: string, productId: string, data: any) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    return await this.reviewRepository.create({
      productId,
      userId,
      rating: data.rating,
      title: data.title,
      comment: data.comment,
    });
  }

  public async deleteReview(reviewId: string) {
    const deleted = await this.reviewRepository.deleteById(reviewId);
    if (!deleted) throw new AppError('Review not found', 404);
  }
}
