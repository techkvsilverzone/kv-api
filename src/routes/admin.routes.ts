import { Router, Request, Response, NextFunction } from 'express';
import { ProductController } from '../controllers/product.controller';
import { OrderController } from '../controllers/order.controller';
import { UserController } from '../controllers/user.controller';
import { CouponController } from '../controllers/coupon.controller';
import { SilverRateController } from '../controllers/silverrate.controller';
import { GoldRateController } from '../controllers/goldrate.controller';
import { MetalRateController } from '../controllers/metalrate.controller';
import { RateGuardService } from '../services/rateGuard.service';
import { ReturnController } from '../controllers/return.controller';
import { SavingsController } from '../controllers/savings.controller';
import { FilterConfigRepository } from '../repositories/filterConfig.repository';
import { StoreConfigRepository } from '../repositories/storeConfig.repository';
import { PricingConfigRepository } from '../repositories/pricingConfig.repository';
import { DeliveryConfigRepository } from '../repositories/deliveryConfig.repository';
import { StallConfigRepository } from '../repositories/stallConfig.repository';
import { InvoiceConfigRepository } from '../repositories/invoiceConfig.repository';
import { UserRepository } from '../repositories/user.repository';
import { sendBroadcast } from '../utils/whatsapp';
import { InventoryController } from '../controllers/inventory.controller';
import { GiftVoucherController } from '../controllers/giftVoucher.controller';
import { protect, admin, adminOrStaff } from '../middlewares/auth.middleware';

const filterConfigRepository = new FilterConfigRepository();
const storeConfigRepository = new StoreConfigRepository();
const pricingConfigRepository = new PricingConfigRepository();
const deliveryConfigRepository = new DeliveryConfigRepository();
const stallConfigRepository = new StallConfigRepository();
const invoiceConfigRepository = new InvoiceConfigRepository();
const userRepositoryForBroadcast = new UserRepository();
const inventoryController = new InventoryController();
const giftVoucherController = new GiftVoucherController();

const router = Router();
const productController = new ProductController();
const orderController = new OrderController();
const userController = new UserController();
const couponController = new CouponController();
const silverRateController = new SilverRateController();
const goldRateController = new GoldRateController();
const metalRateController = new MetalRateController();
const rateGuardService = new RateGuardService();
const returnController = new ReturnController();
const savingsController = new SavingsController();

// The mandatory daily rate update (and its lock status) must be usable by staff, not just
// full admins — RateUpdateGate on the frontend is shown to (and must be clearable by) both.
// Registered ahead of the blanket admin-only gate below so these specific routes use the
// looser adminOrStaff check instead.

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
router.get('/silver-rates', protect, adminOrStaff, silverRateController.getAllRates);

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
router.post('/silver-rates', protect, adminOrStaff, silverRateController.upsertRate);

/**
 * @openapi
 * /admin/gold-rates:
 *   get:
 *     summary: Get all gold rate records
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all gold rate records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date
 *                   rateDate:
 *                     type: string
 *                     format: date
 *                   purity:
 *                     type: string
 *                   ratePerGram:
 *                     type: number
 *                   ratePerKg:
 *                     type: number
 *                   updatedBy:
 *                     type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/gold-rates', protect, adminOrStaff, goldRateController.getAllRates);

/**
 * @openapi
 * /admin/gold-rates:
 *   post:
 *     summary: Upsert today's gold rate
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
 *               - ratePerGram
 *               - purity
 *             properties:
 *               ratePerGram:
 *                 type: number
 *               purity:
 *                 type: string
 *     responses:
 *       201:
 *         description: Gold rate upserted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 date:
 *                   type: string
 *                   format: date
 *                 rateDate:
 *                   type: string
 *                   format: date
 *                 purity:
 *                   type: string
 *                 ratePerGram:
 *                   type: number
 *                 ratePerKg:
 *                   type: number
 *                 updatedBy:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/gold-rates', protect, adminOrStaff, goldRateController.upsertRate);

/**
 * @openapi
 * /admin/rate-status:
 *   get:
 *     summary: Authoritative daily price-update block flag (#25)
 *     description: >
 *       Returns whether the admin panel should be locked because today's
 *       (IST) silver and/or gold rate has not been recorded. Computed by the
 *       10:00 IST cron; safe for the client to use as the source of truth.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current block status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blocked:
 *                   type: boolean
 *                 staleMetals:
 *                   type: array
 *                   items:
 *                     type: string
 *                     enum: ['silver', 'gold']
 *                 checkedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/rate-status', protect, adminOrStaff, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await rateGuardService.getStatus();
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
});

// Apply protect + adminOrStaff to all remaining routes. The frontend Admin.tsx panel treats
// almost every tab (products, orders, customers, savings, coupons, returns, inventory,
// delivery/filter config) as admin-and-staff — only a handful of routes above (store-config,
// pricing-config, gift-vouchers) are deliberately kept stricter via an explicit `admin`
// middleware on top of this, since they have no staff-facing UI and/or are financially sensitive.
router.use(protect, adminOrStaff);

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
 * /admin/users/{id}:
 *   put:
 *     summary: Update a user (admin only, not staff — user management is sensitive)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               isAdmin:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated user
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/users/:id', admin, userController.adminUpdateUser);

/**
 * @openapi
 * /admin/users/{id}:
 *   delete:
 *     summary: Deactivate a user (admin only). Soft delete — preserves order/return/savings history.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deactivated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/users/:id', admin, userController.deleteUser);

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
 * /admin/savings/{id}:
 *   put:
 *     summary: Correct a savings/passbook record (admin only)
 *     description: >
 *       Staff cannot call this — passbook records can only be modified by a full admin.
 *       The passbook number itself is never editable (it's the tracking key already handed
 *       out to the customer); only planName/monthlyAmount/duration/bonusAmount/totalPaid/
 *       status/startDate can be corrected.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planName:
 *                 type: string
 *               monthlyAmount:
 *                 type: integer
 *                 minimum: 1000
 *               duration:
 *                 type: integer
 *                 enum: [6, 11, 12]
 *               bonusAmount:
 *                 type: number
 *               totalPaid:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [Active, Completed, Cancelled]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Updated savings scheme
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/savings/:id', admin, savingsController.adminUpdate);

/**
 * @openapi
 * /admin/savings/{id}:
 *   delete:
 *     summary: Delete a savings/passbook record (admin only)
 *     description: Staff cannot call this — passbook records can only be deleted by a full admin.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Savings scheme deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/savings/:id', admin, savingsController.adminDelete);

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
 * /admin/returns/{id}/video:
 *   get:
 *     summary: Stream the unboxing video attached to a return (video/mp4 or similar)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Video file stream
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/returns/:id/video', returnController.streamReturnVideo);

/**
 * @openapi
 * /admin/return-videos/unmatched:
 *   get:
 *     summary: List unboxing videos received via WhatsApp that could not be auto-matched to a return
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unmatched videos
 */
router.get('/return-videos/unmatched', returnController.listUnmatchedVideos);

/**
 * @openapi
 * /admin/return-videos/unmatched/{id}/file:
 *   get:
 *     summary: Stream an unmatched video
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Video file stream
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/return-videos/unmatched/:id/file', returnController.streamUnmatchedVideo);

/**
 * @openapi
 * /admin/return-videos/unmatched/{id}/link:
 *   post:
 *     summary: Manually link an unmatched WhatsApp video to a return request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [returnId]
 *             properties:
 *               returnId: { type: string }
 *     responses:
 *       200:
 *         description: Return updated with the linked video
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/return-videos/unmatched/:id/link', returnController.linkUnmatchedVideo);

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
 *               $ref: '#/components/schemas/StoreConfig'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// Theme/branding is admin-only in the UI (Theme tab is hidden from staff) — kept stricter
// than the blanket adminOrStaff default below.
// Response is the config object itself, matching adminService.getStoreConfig's
// StoreConfig return type (no {status, data} envelope).
router.get('/store-config', admin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await storeConfigRepository.get();
    res.status(200).json(config ?? { theme: 'icy-silver', isDark: false, marqueeMessages: [] });
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
 *               marqueeMessages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Store theme configuration updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StoreConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/store-config', admin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { theme, isDark, marqueeMessages } = req.body;

    if (typeof theme !== 'string' || !theme.trim()) {
      res.status(400).json({ message: 'theme is required' });
      return;
    }

    if (typeof isDark !== 'boolean') {
      res.status(400).json({ message: 'isDark must be a boolean' });
      return;
    }

    if (marqueeMessages !== undefined && (!Array.isArray(marqueeMessages) || marqueeMessages.some((m) => typeof m !== 'string'))) {
      res.status(400).json({ message: 'marqueeMessages must be an array of strings' });
      return;
    }

    const config = await storeConfigRepository.upsert({
      theme: theme.trim(),
      isDark,
      marqueeMessages: marqueeMessages?.map((m: string) => m.trim()).filter(Boolean),
    });
    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
});

router.post('/store-config', admin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { theme, isDark, marqueeMessages } = req.body;

    if (typeof theme !== 'string' || !theme.trim()) {
      res.status(400).json({ message: 'theme is required' });
      return;
    }

    if (typeof isDark !== 'boolean') {
      res.status(400).json({ message: 'isDark must be a boolean' });
      return;
    }

    if (marqueeMessages !== undefined && (!Array.isArray(marqueeMessages) || marqueeMessages.some((m) => typeof m !== 'string'))) {
      res.status(400).json({ message: 'marqueeMessages must be an array of strings' });
      return;
    }

    const config = await storeConfigRepository.upsert({
      theme: theme.trim(),
      isDark,
      marqueeMessages: marqueeMessages?.map((m: string) => m.trim()).filter(Boolean),
    });
    res.status(200).json(config);
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
// Inventory (stock ledger) is admin-only per product decision — kept stricter than the
// blanket adminOrStaff default below.
router.post('/inventory/inward', admin, inventoryController.inward);

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
router.post('/inventory/outward', admin, inventoryController.outward);

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
router.get('/inventory/transactions', admin, inventoryController.getTransactions);

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
router.post('/inventory/reconcile', admin, inventoryController.reconcile);

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
router.get('/inventory/low-stock', admin, inventoryController.getLowStock);

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
router.get('/inventory/summary', admin, inventoryController.getSummary);

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
// GST rate is financially sensitive and has no staff-facing UI — kept admin-only.
router.get('/pricing-config', admin, async (req: Request, res: Response, next: NextFunction) => {
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
router.put('/pricing-config', admin, async (req: Request, res: Response, next: NextFunction) => {
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
 * /admin/delivery-config:
 *   get:
 *     summary: Get zone-based delivery charges
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delivery charge configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/DeliveryConfig'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/delivery-config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await deliveryConfigRepository.getConfig();
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/delivery-config:
 *   put:
 *     summary: Update zone-based delivery charges (full replace)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeliveryConfig'
 *     responses:
 *       200:
 *         description: Delivery configuration updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/DeliveryConfig'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/delivery-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body ?? {};
    const zones: Array<'chennai' | 'otherDistrict' | 'otherState'> = ['chennai', 'otherDistrict', 'otherState'];
    const values = {} as { chennai: number; otherDistrict: number; otherState: number };

    for (const zone of zones) {
      if (body[zone] === undefined || body[zone] === null) {
        res.status(400).json({ message: `${zone} is required` });
        return;
      }
      const value = Number(body[zone]);
      if (!Number.isFinite(value) || value < 0) {
        res.status(400).json({ message: `${zone} must be a non-negative number` });
        return;
      }
      values[zone] = value;
    }

    const config = await deliveryConfigRepository.upsert(values);
    res.status(200).json({
      status: 'success',
      data: {
        chennai: config.chennai,
        otherDistrict: config.otherDistrict,
        otherState: config.otherState,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/stall-config:
 *   get:
 *     summary: Get offline-stall registration mode status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stall config
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
 *                     active:
 *                       type: boolean
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/stall-config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await stallConfigRepository.getConfig();
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/stall-config:
 *   put:
 *     summary: Enable/disable offline-stall registration mode
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [active]
 *             properties:
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Stall config updated
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
 *                     active:
 *                       type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/stall-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body ?? {};
    if (typeof body.active !== 'boolean') {
      res.status(400).json({ message: 'active must be a boolean' });
      return;
    }
    const config = await stallConfigRepository.upsert({ active: body.active });
    res.status(200).json({ status: 'success', data: { active: config.active } });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/invoice-config:
 *   get:
 *     summary: Get invoice/company details (GSTIN, address)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invoice config
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/invoice-config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await invoiceConfigRepository.getConfig();
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/invoice-config:
 *   put:
 *     summary: Update invoice/company details (GSTIN, address) shown on customer invoices
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
 *               companyName:
 *                 type: string
 *               gstin:
 *                 type: string
 *               companyAddress:
 *                 type: string
 *               companyPhone:
 *                 type: string
 *               companyEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invoice config updated
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/invoice-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body ?? {};
    const fields: Array<'companyName' | 'gstin' | 'companyAddress' | 'companyPhone' | 'companyEmail'> = [
      'companyName',
      'gstin',
      'companyAddress',
      'companyPhone',
      'companyEmail',
    ];
    const values: Record<string, string> = {};
    for (const field of fields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string') {
          res.status(400).json({ message: `${field} must be a string` });
          return;
        }
        values[field] = body[field].trim();
      }
    }
    const config = await invoiceConfigRepository.upsert(values);
    res.status(200).json({
      status: 'success',
      data: {
        companyName: config.companyName,
        gstin: config.gstin,
        companyAddress: config.companyAddress,
        companyPhone: config.companyPhone,
        companyEmail: config.companyEmail,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/whatsapp/broadcast:
 *   post:
 *     summary: Send a WhatsApp broadcast (festival promotions etc.) to customers
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Broadcast dispatched
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
 *                     recipients:
 *                       type: integer
 *                     sent:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/whatsapp/broadcast', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      res.status(400).json({ message: 'message is required' });
      return;
    }

    const customers = await userRepositoryForBroadcast.findRegularCustomers();
    const phones = customers.map((c) => c.phone).filter((p): p is string => !!p);

    const results = await sendBroadcast(phones, message);
    const sent = results.filter((r) => r.result.sent).length;

    res.status(200).json({
      status: 'success',
      data: { recipients: phones.length, sent, failed: phones.length - sent },
    });
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
// Gift voucher denominations affect real discount/refund amounts and have no staff-facing
// UI yet — kept admin-only.
router.get('/gift-vouchers', admin, giftVoucherController.getAllVouchers);

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
router.post('/gift-vouchers', admin, giftVoucherController.createVoucher);

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
router.put('/gift-vouchers/:id', admin, giftVoucherController.updateVoucher);

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
router.delete('/gift-vouchers/:id', admin, giftVoucherController.deleteVoucher);

export default router;
