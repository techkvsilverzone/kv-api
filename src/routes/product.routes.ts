import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { ReviewController } from '../controllers/review.controller';
import { protect, admin } from '../middlewares/auth.middleware';

const router = Router();
const productController = new ProductController();
const reviewController = new ReviewController();

/**
 * @openapi
 * /products:
 *   get:
 *     summary: Get all products with filtering
 *     tags: [Products]
 */
router.get('/', productController.getProducts);

/**
 * @openapi
 * /products/featured:
 *   get:
 *     summary: Get featured products
 *     tags: [Products]
 */
router.get('/featured', productController.getFeatured);

/**
 * @openapi
 * /products/categories:
 *   get:
 *     summary: Get all product categories
 *     tags: [Products]
 */
router.get('/categories', productController.getCategories);

/**
 * @openapi
 * /products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 */
router.get('/:id', productController.getProductById);

/**
 * @openapi
 * /products/{productId}/reviews:
 *   get:
 *     summary: Get all reviews for a product
 *     tags: [Reviews]
 */
router.get('/:productId/reviews', reviewController.getProductReviews);

/**
 * @openapi
 * /products/{productId}/reviews:
 *   post:
 *     summary: Submit a review for a product
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:productId/reviews', protect, reviewController.createReview);

/**
 * @openapi
 * /products/{productId}/reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review (owner or admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:productId/reviews/:reviewId', protect, reviewController.deleteReview);

export default router;
