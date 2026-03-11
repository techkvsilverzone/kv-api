/**
 * Migration script: SQL Server → MongoDB Atlas
 *
 * Reads all data from the local SQL Server and inserts it into MongoDB.
 * Safe to re-run — uses upsert/findOrCreate patterns where possible.
 *
 * Usage:
 *   npx ts-node src/utils/migrateSqlToMongo.ts
 *
 * Prerequisites:
 *   - MONGO_URI set in .env pointing to MongoDB Atlas
 *   - SQL Server still running locally with all data intact
 */

import sql from 'mssql';
import mongoose from 'mongoose';
import { getSqlPool, closeSqlPool } from './sql';
import { connectMongo, disconnectMongo } from './db';
import Logger from './logger';

// ── Models ───────────────────────────────────────────────────────────────────
import { Product } from '../models/product.model';
import { User } from '../models/user.model';
import { Order } from '../models/order.model';
import { Cart } from '../models/cart.model';
import { Coupon } from '../models/coupon.model';
import { SilverRate } from '../models/silverrate.model';
import { Savings } from '../models/savings.model';
import { Return } from '../models/return.model';

// ── ID maps (SQL UUID/INT → Mongo ObjectId) ──────────────────────────────────
const userIdMap = new Map<string, mongoose.Types.ObjectId>();      // SQL UserId → Mongo _id
const productIdMap = new Map<number, mongoose.Types.ObjectId>();   // SQL ImageId → Mongo _id
const orderIdMap = new Map<string, mongoose.Types.ObjectId>();     // SQL OrderId → Mongo _id
const couponIdMap = new Map<string, mongoose.Types.ObjectId>();    // SQL CouponId → Mongo _id

// ─────────────────────────────────────────────────────────────────────────────
async function migrateUsers(pool: sql.ConnectionPool) {
  Logger.info('Migrating users...');

  const result = await pool.request().query(`
    SELECT UserId, Email, PasswordHash, FullName, Phone, IsAdmin, IsActive, CreatedAt, UpdatedAt
    FROM kv.[User];
  `);

  for (const row of result.recordset) {
    const existing = await User.findOne({ email: row.Email.toLowerCase() });
    if (existing) {
      userIdMap.set(row.UserId, existing._id);
      continue;
    }

    const user = await User.create({
      name: row.FullName,
      email: row.Email.toLowerCase(),
      passwordHash: row.PasswordHash || '',
      phone: row.Phone || undefined,
      isAdmin: row.IsAdmin,
      isActive: row.IsActive,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
    });

    userIdMap.set(row.UserId, user._id);
  }

  Logger.info(`  Users migrated: ${userIdMap.size}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateProducts(pool: sql.ConnectionPool) {
  Logger.info('Migrating products...');

  const result = await pool.request().query(`
    SELECT
      pg.ProductGroupCode,
      pg.ItemName,
      pg.Quantity,
      pg.WeightGm,
      pg.Material,
      pg.UnitPriceInr,
      pg.IsActive,
      pg.CreatedAt,
      pg.UpdatedAt,
      pi.ImageId,
      pi.VariantName,
      pi.ImageBase64,
      pi.SortOrder
    FROM kv.ProductGroup AS pg
    LEFT JOIN kv.ProductImage AS pi
      ON pi.ProductGroupId = pg.ProductGroupId
    ORDER BY pg.ProductGroupCode, pi.SortOrder;
  `);

  // Group rows by ProductGroupCode
  const grouped = new Map<string, any[]>();
  for (const row of result.recordset) {
    if (!grouped.has(row.ProductGroupCode)) grouped.set(row.ProductGroupCode, []);
    grouped.get(row.ProductGroupCode)!.push(row);
  }

  for (const [code, rows] of grouped) {
    const first = rows[0];

    const images = rows
      .filter((r: any) => r.ImageId !== null)
      .map((r: any) => ({
        variantName: r.VariantName || 'Default view',
        imageBase64: r.ImageBase64 || '',
        sortOrder: r.SortOrder || 1,
      }));

    let product = await Product.findOne({ productGroupCode: code.toUpperCase() });

    if (!product) {
      product = await Product.create({
        productGroupCode: code.toUpperCase(),
        name: first.ItemName,
        material: first.Material,
        weight: first.WeightGm || 0,
        price: first.UnitPriceInr,
        quantity: first.Quantity,
        isActive: first.IsActive,
        images,
        createdAt: first.CreatedAt,
        updatedAt: first.UpdatedAt,
      });
    }

    // Map every ImageId to this product's Mongo _id
    for (const row of rows) {
      if (row.ImageId !== null) {
        productIdMap.set(row.ImageId, product._id);
      }
    }
  }

  Logger.info(`  Products migrated: ${grouped.size}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateOrders(pool: sql.ConnectionPool) {
  Logger.info('Migrating orders...');

  const result = await pool.request().query(`
    SELECT
      o.OrderId,
      o.UserId,
      o.TotalAmount,
      o.TaxAmount,
      o.[Status],
      o.PaymentMethod,
      o.RazorpayPaymentId,
      o.CouponCode,
      o.CouponDiscount,
      o.CreatedAt AS OrderCreatedAt,
      o.UpdatedAt AS OrderUpdatedAt,
      s.FirstName,
      s.LastName,
      s.AddressLine,
      s.City,
      s.[State],
      s.Pincode,
      s.Phone,
      oi.OrderItemId,
      oi.ImageId,
      oi.ProductName,
      oi.UnitPrice,
      oi.Quantity,
      oi.ImageUrl
    FROM kv.[Order] AS o
    LEFT JOIN kv.OrderShippingAddress AS s ON s.OrderId = o.OrderId
    LEFT JOIN kv.OrderItem AS oi ON oi.OrderId = o.OrderId
    ORDER BY o.CreatedAt, oi.CreatedAt;
  `);

  // Group by OrderId
  const grouped = new Map<string, any[]>();
  for (const row of result.recordset) {
    if (!grouped.has(row.OrderId)) grouped.set(row.OrderId, []);
    grouped.get(row.OrderId)!.push(row);
  }

  let count = 0;
  for (const [sqlOrderId, rows] of grouped) {
    const first = rows[0];
    const mongoUserId = userIdMap.get(first.UserId);
    if (!mongoUserId) {
      Logger.warn(`  [SKIP] Order ${sqlOrderId} — user not found`);
      continue;
    }

    const items = rows
      .filter((r: any) => r.OrderItemId !== null)
      .map((r: any) => {
        const productMongoId = r.ImageId !== null ? productIdMap.get(r.ImageId) : undefined;
        return {
          productId: productMongoId || new mongoose.Types.ObjectId(),
          productGroupCode: '',
          productName: r.ProductName || '',
          quantity: r.Quantity || 1,
          weight: 0,
          unitPrice: r.UnitPrice || 0,
          totalPrice: (r.UnitPrice || 0) * (r.Quantity || 1),
        };
      });

    const order = await Order.create({
      userId: mongoUserId,
      status: first.Status,
      paymentMethod: ['cod', 'razorpay'].includes(first.PaymentMethod)
        ? first.PaymentMethod
        : 'cod',
      paymentStatus: first.RazorpayPaymentId ? 'Paid' : 'Pending',
      razorpayPaymentId: first.RazorpayPaymentId || undefined,
      couponCode: first.CouponCode || undefined,
      couponDiscount: first.CouponDiscount || 0,
      totalAmount: first.TotalAmount,
      tax: first.TaxAmount || 0,
      shippingAddress: {
        name: `${first.FirstName || ''} ${first.LastName || ''}`.trim() || 'N/A',
        phone: first.Phone || '',
        line1: first.AddressLine || '',
        city: first.City || '',
        state: first.State || '',
        pincode: first.Pincode || '',
        country: 'India',
      },
      items,
      createdAt: first.OrderCreatedAt,
      updatedAt: first.OrderUpdatedAt,
    });

    orderIdMap.set(sqlOrderId, order._id);
    count++;
  }

  Logger.info(`  Orders migrated: ${count}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateCarts(pool: sql.ConnectionPool) {
  Logger.info('Migrating carts...');

  const result = await pool.request().query(`
    SELECT c.UserId, ci.ImageId, ci.Quantity
    FROM kv.Cart AS c
    LEFT JOIN kv.CartItem AS ci ON ci.CartId = c.CartId
    ORDER BY c.UserId, ci.CreatedAt;
  `);

  const grouped = new Map<string, any[]>();
  for (const row of result.recordset) {
    if (!grouped.has(row.UserId)) grouped.set(row.UserId, []);
    if (row.ImageId !== null) grouped.get(row.UserId)!.push(row);
  }

  let count = 0;
  for (const [sqlUserId, rows] of grouped) {
    const mongoUserId = userIdMap.get(sqlUserId);
    if (!mongoUserId) continue;

    const items = rows
      .map((r: any) => {
        const productMongoId = productIdMap.get(r.ImageId);
        if (!productMongoId) return null;
        return {
          productId: productMongoId,
          productGroupCode: '',
          productName: '',
          quantity: r.Quantity || 1,
          weight: 0,
          unitPrice: 0,
        };
      })
      .filter(Boolean);

    await Cart.findOneAndUpdate(
      { userId: mongoUserId },
      { items },
      { upsert: true, new: true },
    );
    count++;
  }

  Logger.info(`  Carts migrated: ${count}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateCoupons(pool: sql.ConnectionPool) {
  Logger.info('Migrating coupons...');

  const result = await pool.request().query(`
    SELECT CouponId, Code, DiscountType, DiscountValue, MinOrderAmount,
           ValidTo, UsageLimit, UsedCount, IsActive, CreatedAt, UpdatedAt
    FROM kv.Coupon;
  `);

  let count = 0;
  for (const row of result.recordset) {
    const existing = await Coupon.findOne({ code: row.Code.toUpperCase() });
    if (existing) {
      couponIdMap.set(row.CouponId, existing._id);
      continue;
    }

    const coupon = await Coupon.create({
      code: row.Code.toUpperCase(),
      discountType: row.DiscountType,
      discountValue: row.DiscountValue,
      minOrderAmount: row.MinOrderAmount || 0,
      maxUses: row.UsageLimit || 0,
      usedCount: row.UsedCount || 0,
      expiryDate: row.ValidTo || new Date(),
      isActive: row.IsActive,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
    });

    couponIdMap.set(row.CouponId, coupon._id);
    count++;
  }

  Logger.info(`  Coupons migrated: ${count}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateSilverRates(pool: sql.ConnectionPool) {
  Logger.info('Migrating silver rates...');

  const result = await pool.request().query(`
    SELECT RateDate, Purity, RatePerGram, RatePerKg, UpdatedBy, CreatedAt, UpdatedAt
    FROM kv.SilverRate
    ORDER BY RateDate;
  `);

  let count = 0;
  for (const row of result.recordset) {
    const rateDate = new Date(row.RateDate);
    rateDate.setHours(0, 0, 0, 0);

    await SilverRate.findOneAndUpdate(
      { rateDate, purity: row.Purity },
      {
        ratePerGram: row.RatePerGram,
        ratePerKg: row.RatePerKg,
        updatedBy: row.UpdatedBy || undefined,
      },
      { upsert: true, new: true },
    );
    count++;
  }

  Logger.info(`  Silver rates migrated: ${count}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateSavings(pool: sql.ConnectionPool) {
  Logger.info('Migrating savings enrollments...');

  const enrollments = await pool.request().query(`
    SELECT SavingsEnrollmentId, UserId, MonthlyAmount, DurationMonths,
           StartDate, [Status], TotalPaid, BonusAmount, CreatedAt, UpdatedAt
    FROM kv.SavingsEnrollment;
  `);

  const payments = await pool.request().query(`
    SELECT SavingsEnrollmentId, Amount, MonthNumber, PaidDate
    FROM kv.SavingsPayment
    ORDER BY MonthNumber;
  `);

  const paymentsByEnrollment = new Map<string, any[]>();
  for (const row of payments.recordset) {
    if (!paymentsByEnrollment.has(row.SavingsEnrollmentId)) {
      paymentsByEnrollment.set(row.SavingsEnrollmentId, []);
    }
    paymentsByEnrollment.get(row.SavingsEnrollmentId)!.push({
      month: row.MonthNumber,
      amount: row.Amount,
      paidAt: row.PaidDate,
    });
  }

  let count = 0;
  for (const row of enrollments.recordset) {
    const mongoUserId = userIdMap.get(row.UserId);
    if (!mongoUserId) continue;

    const status = row.Status === 'Defaulted' ? 'Cancelled' : row.Status;

    await Savings.create({
      userId: mongoUserId,
      planName: 'Silver Savings',
      monthlyAmount: row.MonthlyAmount,
      duration: row.DurationMonths,
      bonusAmount: row.BonusAmount || 0,
      totalPaid: row.TotalPaid || 0,
      status,
      payments: paymentsByEnrollment.get(row.SavingsEnrollmentId) || [],
      startDate: row.StartDate,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
    });
    count++;
  }

  Logger.info(`  Savings enrollments migrated: ${count}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function migrateReturns(pool: sql.ConnectionPool) {
  Logger.info('Migrating return requests...');

  const result = await pool.request().query(`
    SELECT
      rr.ReturnRequestId, rr.OrderId, rr.UserId,
      rr.Reason, rr.Description, rr.[Status], rr.RefundAmount,
      rr.CreatedAt, rr.UpdatedAt,
      ri.ReturnItemId, ri.ImageId, ri.ProductName, ri.Quantity, ri.Price
    FROM kv.ReturnRequest AS rr
    LEFT JOIN kv.ReturnItem AS ri ON ri.ReturnRequestId = rr.ReturnRequestId
    ORDER BY rr.CreatedAt, ri.ReturnItemId;
  `);

  const grouped = new Map<string, any[]>();
  for (const row of result.recordset) {
    if (!grouped.has(row.ReturnRequestId)) grouped.set(row.ReturnRequestId, []);
    grouped.get(row.ReturnRequestId)!.push(row);
  }

  let count = 0;
  for (const [, rows] of grouped) {
    const first = rows[0];
    const mongoUserId = userIdMap.get(first.UserId);
    const mongoOrderId = orderIdMap.get(first.OrderId);
    if (!mongoUserId || !mongoOrderId) continue;

    const items = rows
      .filter((r: any) => r.ReturnItemId !== null)
      .map((r: any) => ({
        orderItemId: new mongoose.Types.ObjectId(),
        productName: r.ProductName || '',
        quantity: r.Quantity || 1,
      }));

    await Return.create({
      userId: mongoUserId,
      orderId: mongoOrderId,
      reason: first.Reason || first.Description || 'Return request',
      status: first.Status,
      refundAmount: first.RefundAmount || 0,
      items,
      createdAt: first.CreatedAt,
      updatedAt: first.UpdatedAt,
    });
    count++;
  }

  Logger.info(`  Return requests migrated: ${count}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  Logger.info('=== SQL Server → MongoDB Migration ===');

  Logger.info('Connecting to SQL Server...');
  const pool = await getSqlPool();
  Logger.info('Connected to SQL Server');

  Logger.info('Connecting to MongoDB...');
  await connectMongo();
  Logger.info('Connected to MongoDB');

  await migrateUsers(pool);
  await migrateProducts(pool);
  await migrateOrders(pool);
  await migrateCarts(pool);
  await migrateCoupons(pool);
  await migrateSilverRates(pool);
  await migrateSavings(pool);
  await migrateReturns(pool);

  Logger.info('=== Migration complete ===');

  await closeSqlPool();
  await disconnectMongo();
  process.exit(0);
}

main().catch((err) => {
  Logger.error(`Migration failed: ${String(err)}`);
  process.exit(1);
});
