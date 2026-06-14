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
import { StoreConfigRepository } from '../repositories/storeConfig.repository';
import { PricingConfigRepository } from '../repositories/pricingConfig.repository';
import { InventoryController } from '../controllers/inventory.controller';
import { GiftVoucherController } from '../controllers/giftVoucher.controller';
import { protect, admin } from '../middlewares/auth.middleware';

const filterConfigRepository = new FilterConfigRepository();
const storeConfigRepository = new StoreConfigRepository();
const pricingConfigRepository = new PricingConfigRepository();
const inventoryController = new InventoryController();
const giftVoucherController = new GiftVoucherController();

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
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRevenue:
 *                   type: number
 *                 totalOrders:
 *                   type: integer
 *                 totalProducts:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     responses:
 *       200:
 *         description: List of all orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       204:
 *         description: Product deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: New order status
 *     responses:
 *       200:
 *         description: Order updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 *     responses:
 *       200:
 *         description: List of all savings enrollments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     responses:
 *       200:
 *         description: List of all coupons
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Coupon'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponInput'
 *     responses:
 *       201:
 *         description: Coupon created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Coupon'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Coupon ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponInput'
 *     responses:
 *       200:
 *         description: Coupon updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Coupon'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Coupon ID
 *     responses:
 *       204:
 *         description: Coupon deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 *     responses:
 *       200:
 *         description: List of all silver rate records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   ratePerGram:
 *                     type: number
 *                   purity:
 *                     type: string
 *                   updatedBy:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ratePerGram
 *               - purity
 *             properties:
 *               ratePerGram:
 *                 type: number
 *               purity:
 *                 type: string
 *     responses:
 *       201:
 *         description: Silver rate upserted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ratePerGram:
 *                   type: number
 *                 purity:
 *                   type: string
 *                 updatedBy:
 *                   type: string
 *                 date:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     responses:
 *       200:
 *         description: List of all metal rate records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MetalRate'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MetalRateInput'
 *     responses:
 *       201:
 *         description: Metal rate upserted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetalRate'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     responses:
 *       200:
 *         description: List of all return requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Return request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: New return request status
 *     responses:
 *       200:
 *         description: Return request updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
 *     responses:
 *       200:
 *         description: Shop filter configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     hiddenCategories:
 *                       type: array
 *                       items:
 *                         type: string
 *                     metals:
 *                       type: array
 *                       items:
 *                         type: string
 *                     priceRanges:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hiddenCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *               metals:
 *                 type: array
 *                 items:
 *                   type: string
 *               priceRanges:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Shop filter configuration updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     hiddenCategories:
 *                       type: array
 *                       items:
 *                         type: string
 *                     metals:
 *                       type: array
 *                       items:
 *                         type: string
 *                     priceRanges:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
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

/**
 * @openapi
 * /admin/store-config:
 *   get:
 *     summary: Get store theme configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Store theme configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/StoreConfig'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/store-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await storeConfigRepository.get();
    res.status(200).json({
      status: 'success',
      data: config ?? { theme: 'icy-silver', isDark: false },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/store-config:
 *   put:
 *     summary: Update store theme configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - theme
 *               - isDark
 *             properties:
 *               theme:
 *                 type: string
 *               isDark:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Store theme configuration updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/StoreConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/store-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { theme, isDark } = req.body;

    if (typeof theme !== 'string' || !theme.trim()) {
      res.status(400).json({ message: 'theme is required' });
      return;
    }

    if (typeof isDark !== 'boolean') {
      res.status(400).json({ message: 'isDark must be a boolean' });
      return;
    }

    const config = await storeConfigRepository.upsert({ theme: theme.trim(), isDark });
    res.status(200).json({ status: 'success', data: config });
  } catch (error) {
    next(error);
  }
});

router.post('/store-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { theme, isDark } = req.body;

    if (typeof theme !== 'string' || !theme.trim()) {
      res.status(400).json({ message: 'theme is required' });
      return;
    }

    if (typeof isDark !== 'boolean') {
      res.status(400).json({ message: 'isDark must be a boolean' });
      return;
    }

    const config = await storeConfigRepository.upsert({ theme: theme.trim(), isDark });
    res.status(200).json({ status: 'success', data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/inventory/inward:
 *   post:
 *     summary: Record stock inward (supplier delivery, returns)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *               - reason
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Stock inward recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 transaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [IN, OUT]
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                     reason:
 *                       type: string
 *                     date:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/inventory/inward', inventoryController.inward);

/**
 * @openapi
 * /admin/inventory/outward:
 *   post:
 *     summary: Record stock outward (damages, shrinkage)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *               - reason
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Stock outward recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 transaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [IN, OUT]
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                     reason:
 *                       type: string
 *                     date:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/inventory/outward', inventoryController.outward);

/**
 * @openapi
 * /admin/inventory/transactions:
 *   get:
 *     summary: Get inventory transaction ledger
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by product ID
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [IN, OUT]
 *         description: Filter by transaction type
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: Maximum number of records to return
 *     responses:
 *       200:
 *         description: Inventory transaction ledger
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/inventory/transactions', inventoryController.getTransactions);

/**
 * @openapi
 * /admin/inventory/reconcile:
 *   post:
 *     summary: Reconcile stock with a physical count
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - physicalCount
 *               - reason
 *             properties:
 *               productId:
 *                 type: string
 *               physicalCount:
 *                 type: integer
 *                 minimum: 0
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock reconciled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 previousStock:
 *                   type: integer
 *                 currentStock:
 *                   type: integer
 *                 physicalCount:
 *                   type: integer
 *                 adjustment:
 *                   type: integer
 *                 transaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [IN, OUT]
 *                     quantity:
 *                       type: integer
 *                     date:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/inventory/reconcile', inventoryController.reconcile);

/**
 * @openapi
 * /admin/inventory/low-stock:
 *   get:
 *     summary: Get products below stock threshold
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Products at or below stock threshold
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 lowStockItems:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       currentStock:
 *                         type: integer
 *                       threshold:
 *                         type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/inventory/low-stock', inventoryController.getLowStock);

/**
 * @openapi
 * /admin/inventory/summary:
 *   get:
 *     summary: Get inventory analytics summary
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 totalItemsInStock:
 *                   type: integer
 *                 lowStockCount:
 *                   type: integer
 *                 outOfStockCount:
 *                   type: integer
 *                 recentMovements:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/inventory/summary', inventoryController.getSummary);

/**
 * @openapi
 * /admin/pricing-config:
 *   get:
 *     summary: Get pricing configuration (GST rate)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pricing configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/PricingConfig'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/pricing-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await pricingConfigRepository.get();
    res.status(200).json({ status: 'success', data: { gstPercent: config?.gstPercent ?? 3 } });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/pricing-config:
 *   put:
 *     summary: Update the GST rate applied at checkout
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - gstPercent
 *             properties:
 *               gstPercent:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Pricing configuration updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/PricingConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/pricing-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gstPercent = Number(req.body?.gstPercent);
    if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) {
      res.status(400).json({ message: 'gstPercent must be a number between 0 and 100' });
      return;
    }
    const config = await pricingConfigRepository.upsert({ gstPercent });
    res.status(200).json({ status: 'success', data: { gstPercent: config.gstPercent } });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/gift-vouchers:
 *   get:
 *     summary: List all gift voucher denominations (incl. inactive)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of gift voucher denominations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GiftVoucher'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/gift-vouchers', giftVoucherController.getAllVouchers);

/**
 * @openapi
 * /admin/gift-vouchers:
 *   post:
 *     summary: Create a gift voucher denomination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GiftVoucherInput'
 *     responses:
 *       201:
 *         description: Gift voucher denomination created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/GiftVoucher'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/gift-vouchers', giftVoucherController.createVoucher);

/**
 * @openapi
 * /admin/gift-vouchers/{id}:
 *   put:
 *     summary: Update a gift voucher denomination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Gift voucher ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GiftVoucherInput'
 *     responses:
 *       200:
 *         description: Gift voucher denomination updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/GiftVoucher'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/gift-vouchers/:id', giftVoucherController.updateVoucher);

/**
 * @openapi
 * /admin/gift-vouchers/{id}:
 *   delete:
 *     summary: Delete a gift voucher denomination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Gift voucher ID
 *     responses:
 *       204:
 *         description: Gift voucher denomination deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/gift-vouchers/:id', giftVoucherController.deleteVoucher);

export default router;
