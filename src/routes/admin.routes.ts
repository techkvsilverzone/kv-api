import { Router, Request, Response, NextFunction } from 'express';
import { ProductController } from '../controllers/product.controller';
import { OrderController } from '../controllers/order.controller';
import { UserController } from '../controllers/user.controller';
import { CouponController } from '../controllers/coupon.controller';
import { SilverRateController } from '../controllers/silverrate.controller';
import { MetalRateController } from '../controllers/metalrate.controller';
import { ReturnController } from '../controllers/return.controller';
import { SavingsController } from '../controllers/savings.controller';
import { FilterConfigRepository } from '../repositories/filterConfig.repository';
import { protect, admin } from '../middlewares/auth.middleware';

const filterConfigRepository = new FilterConfigRepository();

const router = Router();
const productController = new ProductController();
const orderController = new OrderController();
const userController = new UserController();
const couponController = new CouponController();
const silverRateController = new SilverRateController();
const metalRateController = new MetalRateController();
const returnController = new ReturnController();
const savingsController = new SavingsController();

// Apply protect and admin to all routes
router.use(protect, admin);

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', orderController.getStats);

/**
 * @openapi
 * /admin/orders:
 *   get:
 *     summary: Get all orders
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/orders', orderController.getAllOrders);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/users', userController.getAllUsers);

/**
 * @openapi
 * /products:
 *   post:
 *     summary: Add new product
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/products', productController.createProduct);

/**
 * @openapi
 * /products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/products/:id', productController.updateProduct);

/**
 * @openapi
 * /products/{id}:
 *   delete:
 *     summary: Delete product
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/products/:id', productController.deleteProduct);

/**
 * @openapi
 * /orders/{id}/status:
 *   put:
 *     summary: Update order status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/orders/:id/status', orderController.updateStatus);

/**
 * @openapi
 * /admin/savings:
 *   get:
 *     summary: Get all savings enrollments
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/savings', savingsController.getAllSchemes);

/**
 * @openapi
 * /admin/coupons:
 *   get:
 *     summary: List all coupons
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/coupons', couponController.getAllCoupons);

/**
 * @openapi
 * /admin/coupons:
 *   post:
 *     summary: Create a new coupon
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/coupons', couponController.createCoupon);

/**
 * @openapi
 * /admin/coupons/{id}:
 *   put:
 *     summary: Update a coupon
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/coupons/:id', couponController.updateCoupon);

/**
 * @openapi
 * /admin/coupons/{id}:
 *   delete:
 *     summary: Delete a coupon
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/coupons/:id', couponController.deleteCoupon);

/**
 * @openapi
 * /admin/silver-rates:
 *   get:
 *     summary: Get all silver rate records
 *     tags: [Admin]
 *     deprecated: true
 *     security:
 *       - bearerAuth: []
 */
router.get('/silver-rates', silverRateController.getAllRates);

/**
 * @openapi
 * /admin/silver-rates:
 *   post:
 *     summary: Upsert today's silver rate for a purity
 *     tags: [Admin]
 *     deprecated: true
 *     security:
 *       - bearerAuth: []
 */
router.post('/silver-rates', silverRateController.upsertRate);

/**
 * @openapi
 * /admin/metal-rates:
 *   get:
 *     summary: Get all metal rate records
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/metal-rates', metalRateController.getAllRates);

/**
 * @openapi
 * /admin/metal-rates:
 *   post:
 *     summary: Upsert metal rate for date + metal + karat
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/metal-rates', metalRateController.upsertRate);

/**
 * @openapi
 * /admin/returns:
 *   get:
 *     summary: Get all return requests
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/returns', returnController.getAllReturns);

/**
 * @openapi
 * /admin/returns/{id}:
 *   put:
 *     summary: Update a return request status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/returns/:id', returnController.updateReturnStatus);

/**
 * @openapi
 * /admin/filter-config:
 *   get:
 *     summary: Get shop filter configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/filter-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await filterConfigRepository.get();
    res.status(200).json({
      status: 'success',
      data: config ?? { hiddenCategories: [], metals: [], priceRanges: [] },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/filter-config:
 *   put:
 *     summary: Replace shop filter configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put('/filter-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hiddenCategories, metals, priceRanges } = req.body;
    const config = await filterConfigRepository.upsert({ hiddenCategories, metals, priceRanges });
    res.status(200).json({ status: 'success', data: config });
  } catch (error) {
    next(error);
  }
});

export default router;
