# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-04-05T06:40:27.717Z
> Files: 120 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `.gitignore` — Git ignore rules (~611 tok)
- `API_DEFINITION_LATEST.md` — KV Silver Zone — Complete API Definition (~5739 tok)
- `API_DOCUMENTATION.md` — KV Silver Zone API Documentation (~2494 tok)
- `CLAUDE.md` — CLAUDE.md (~606 tok)
- `DEPLOYMENT.md` — Deployment Guide — Hostinger KVM VPS (~2143 tok)
- `install.cmd` (~1759 tok)
- `jest.config.js` — Jest test configuration (~58 tok)
- `package-lock.json` — npm lock file (~85802 tok)
- `package.json` — Node.js package manifest (~374 tok)
- `README.md` — Project documentation (~738 tok)
- `tsconfig.json` — TypeScript configuration (~105 tok)

## .claude/

- `settings.json` (~441 tok)
- `settings.local.json` (~129 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .github/

- `copilot-instructions.md` — Project Summary (~347 tok)

## C:/Users/Gayathri/.claude/projects/d--KraftLabs-KV-Silver-Zone-Source-kv-api/memory/

- `MEMORY.md` — KV Silver Zone API — Project Memory (~912 tok)

## database/sqlserver/

- `001_create_schema.sql` — SQL: tables: kv, kv, kv, 1 alter(s) (~1373 tok)
- `002_seed_products.sql` (~1739 tok)
- `003_create_domain_schema.sql` — SQL: tables: kv, kv, kv, kv, 1 alter(s), 1 view(s) (~2876 tok)
- `004_seed_domain_data.sql` (~2087 tok)
- `005_migrate_productimage_base64.sql` — SQL: 1 alter(s), 1 view(s) (~795 tok)
- `006_create_missing_features.sql` — SQL: tables: kv, kv, kv, kv, 7 alter(s) (~3692 tok)
- `README.md` — Project documentation (~1010 tok)

## database/sqlserver/generated/

- `006_image_mapping_generated.csv` (~1012 tok)
- `006_unassigned_images.txt` (~63 tok)

## logs/

- `all.log` (~49292 tok)
- `error.log` — Declares string (~11279 tok)

## src/

- `app.ts` — API routes: GET (3 endpoints) (~564 tok)
- `seed.ts` — Declares seed (~145 tok)
- `server.ts` — Declares PORT (~161 tok)

## src/config/

- `index.ts` — Exports config (~291 tok)
- `swagger.ts` — Exports specs (~218 tok)

## src/controllers/

- `cart.controller.ts` — Exports CartController (~372 tok)
- `coupon.controller.ts` — Exports CouponController (~489 tok)
- `delivery.controller.ts` — Non-serviceable pincode prefixes (remote areas: Andaman & Nicobar, Lakshadweep) (~309 tok)
- `health.controller.ts` — Exports HealthController (~73 tok)
- `metalrate.controller.ts` — Exports MetalRateController (~538 tok)
- `order.controller.ts` — Exports OrderController (~615 tok)
- `payment.controller.ts` — Exports PaymentController (~421 tok)
- `product.controller.ts` — Exports ProductController (~663 tok)
- `return.controller.ts` — Exports ReturnController (~475 tok)
- `review.controller.ts` — Exports ReviewController (~400 tok)
- `savings.controller.ts` — Request is used for admin endpoints that don't need user context (~492 tok)
- `shipping.controller.ts` — Exports ShippingController (~438 tok)
- `silverrate.controller.ts` — Exports SilverRateController (~468 tok)
- `user.controller.ts` — Exports UserController (~585 tok)
- `wishlist.controller.ts` — Exports WishlistController (~416 tok)

## src/middlewares/

- `auth.middleware.ts` — Exports AuthRequest, protect, admin (~408 tok)
- `error.middleware.ts` — Exports errorMiddleware (~416 tok)

## src/models/

- `cart.model.ts` — Exports ICartItem, ICart, Cart (~336 tok)
- `coupon.model.ts` — Exports ICoupon, Coupon (~297 tok)
- `filterConfig.model.ts` — Exports IPriceRange, IFilterConfig, FilterConfig (~270 tok)
- `inventoryTransaction.model.ts` — Exports TransactionType, IInventoryTransaction, InventoryTransaction
- `metalrate.model.ts` — Exports MetalType, IMetalRate, MetalRate (~287 tok)
- `order.model.ts` — Exports IOrderItem, IShippingAddress, IOrder, Order (~1078 tok)
- `pincodeRate.model.ts` — Exports IPincodeRate, PincodeRate (~175 tok)
- `product.model.ts` — Exports IProductImage, IProduct, Product. Added stockThreshold (default 5) (~561 tok)
- `return.model.ts` — Exports IReturnItem, IReturn, Return (~437 tok)
- `review.model.ts` — Exports IReview, Review (~239 tok)
- `savings.model.ts` — Exports ISavingsPayment, ISavings, Savings (~475 tok)
- `silverrate.model.ts` — Exports ISilverRate, SilverRate (~258 tok)
- `user.model.ts` — Exports IUser, User (~286 tok)
- `wishlist.model.ts` — Exports IWishlistItem, IWishlist, Wishlist (~210 tok)

## src/repositories/

- `cart.repository.ts` — Exports CartRepository (~506 tok)
- `coupon.repository.ts` — Exports CouponRepository (~534 tok)
- `filterConfig.repository.ts` — Exports FilterConfigRepository (~221 tok)
- `metalrate.repository.ts` — Exports MetalRateUpsertParams, MetalRateRepository (~556 tok)
- `order.repository.ts` — Exports OrderRepository (~1110 tok)
- `pincodeRate.repository.ts` — Exports PincodeRateRepository (~242 tok)
- `product.repository.ts` — Exports ProductRepository (~1762 tok)
- `return.repository.ts` — Exports ReturnRepository (~582 tok)
- `review.repository.ts` — Exports IReview, ReviewRepository (~822 tok)
- `savings.repository.ts` — Exports SavingsRepository (~609 tok)
- `silverrate.repository.ts` — Exports SilverRateRepository (~385 tok)
- `user.repository.ts` — Exports IUserWithPassword, UserRepository (~516 tok)
- `wishlist.repository.ts` — Exports WishlistRepository (~412 tok)

## src/routes/

- `admin.routes.ts` — API routes: GET, POST, PUT, DELETE (20 endpoints) (~1877 tok)
- `auth.routes.ts` — API routes: POST (3 endpoints) (~461 tok)
- `cart.routes.ts` — API routes: GET, POST, DELETE (3 endpoints) (~261 tok)
- `coupon.routes.ts` — API routes: POST (1 endpoints) (~144 tok)
- `delivery.routes.ts` — API routes: GET (1 endpoints) (~183 tok)
- `health.routes.ts` — API routes: GET (1 endpoints) (~226 tok)
- `index.ts` — Declares router (~438 tok)
- `metalrate.routes.ts` — API routes: GET (2 endpoints) (~227 tok)
- `misc.routes.ts` — API routes: POST (1 endpoints) (~420 tok)
- `order.routes.ts` — API routes: POST, GET (3 endpoints) (~301 tok)
- `payment.routes.ts` — API routes: POST (2 endpoints) (~221 tok)
- `product.routes.ts` — API routes: GET, POST, DELETE (7 endpoints) (~540 tok)
- `return.routes.ts` — API routes: POST, GET (2 endpoints) (~203 tok)
- `savings.routes.ts` — API routes: POST, GET (3 endpoints) (~290 tok)
- `shipping.routes.ts` — API routes: GET, POST, DELETE (3 endpoints) (~343 tok)
- `silverrate.routes.ts` — API routes: GET (2 endpoints) (~244 tok)
- `user.routes.ts` — API routes: GET, PUT (2 endpoints) (~198 tok)
- `wishlist.routes.ts` — API routes: GET, POST, DELETE (3 endpoints) (~286 tok)

## src/services/

- `cart.service.ts` — Exports CartService (~388 tok)
- `coupon.service.ts` — Exports CouponService (~640 tok)
- `metalrate.service.ts` — Exports MetalRateResponse, MetalRateUpsertInput, MetalRateService (~1000 tok)
- `order.service.ts` — Exports OrderService (~1064 tok)
- `payment.service.ts` — Exports PaymentService (~1350 tok)
- `product.service.ts` — Exports ProductService (~2435 tok)
- `return.service.ts` — Exports ReturnService (~293 tok)
- `review.service.ts` — Exports ReviewService (~485 tok)
- `savings.service.ts` — Exports SavingsService (~506 tok)
- `silverrate.service.ts` — Exports LegacySilverRateResponse, SilverRateService (~524 tok)
- `user.service.ts` — Exports UserService (~918 tok)
- `wishlist.service.ts` — Exports WishlistService (~185 tok)

## src/tests/

- `admin-orders.api.test.ts` — API routes: POST, GET (3 endpoints) (~770 tok)
- `admin-products-frontend-shape.api.test.ts` — Stub the repository so the full validateCreatePayload logic runs but no DB call is made (~1107 tok)
- `admin-products.api.test.ts` — API routes: POST, PUT, DELETE (7 endpoints) (~1140 tok)
- `coupon-apply.api.test.ts` — API routes: POST (5 endpoints) (~793 tok)
- `review-delete.api.test.ts` — API routes: DELETE (4 endpoints) (~724 tok)

## src/utils/

- `appError.ts` — Exports AppError (~103 tok)
- `db.ts` — Exports connectMongo, disconnectMongo (~100 tok)
- `email.ts` — Exports EmailAddress, EmailAttachment, SendEmailInput, sendEmail (~777 tok)
- `emailNotifications.ts` — Exports sendOrderCreatedEmails, sendContactUsEmail, sendPaymentCompletedEmails, sendNewProductPromotion (~2338 tok)
- `jwt.ts` — Exports generateToken (~65 tok)
- `logger.ts` — Declares levels (~308 tok)
- `migrateSqlToMongo.ts` — Migration script: SQL Server → MongoDB Atlas (~4450 tok)
- `seeder.ts` — Exports seedAdmin (~304 tok)
- `seedImages.ts` — Exports seedImages (~2571 tok)
- `sql.ts` — Exports getSqlPool, closeSqlPool (~588 tok)
