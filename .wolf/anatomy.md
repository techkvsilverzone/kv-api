# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-06-14T12:20:36.982Z
> Files: 137 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `.gitignore` — Git ignore rules (~611 tok)
- `API_DEFINITION_LATEST.md` — KV Silver Zone — Complete API Definition (~5739 tok)
- `API_DOCUMENTATION.md` — KV Silver Zone API Documentation (~2494 tok)
- `CLAUDE.md` — CLAUDE.md (~845 tok)
- `DEPLOYMENT.md` — Deployment Guide — Hostinger KVM VPS (~2143 tok)
- `install.cmd` (~1759 tok)
- `jest.config.js` — Jest test configuration (~58 tok)
- `package-lock.json` — npm lock file (~85802 tok)
- `package.json` — Node.js package manifest (~406 tok)
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

- `app.ts` — API routes: GET (3 endpoints) (~692 tok)
- `seed.ts` — Declares seed (~145 tok)
- `server.ts` — Declares PORT (~161 tok)

## src/config/

- `index.ts` — Exports config (~486 tok)
- `swagger.ts` — Declares options (~5728 tok)

## src/controllers/

- `cart.controller.ts` — Exports CartController (~372 tok)
- `coupon.controller.ts` — Exports CouponController (~489 tok)
- `delivery.controller.ts` — Non-serviceable pincode prefixes (remote areas: Andaman & Nicobar, Lakshadweep) (~309 tok)
- `giftVoucher.controller.ts` — Exports GiftVoucherController (~562 tok)
- `health.controller.ts` — Exports HealthController (~73 tok)
- `metalrate.controller.ts` — Exports MetalRateController (~538 tok)
- `order.controller.ts` — Exports OrderController (~726 tok)
- `payment.controller.ts` — Exports PaymentController (~467 tok)
- `product.controller.ts` — Exports ProductController (~663 tok)
- `return.controller.ts` — Exports ReturnController (~475 tok)
- `review.controller.ts` — Exports ReviewController (~400 tok)
- `savings.controller.ts` — Request is used for admin endpoints that don't need user context (~492 tok)
- `shipping.controller.ts` — Exports ShippingController (~438 tok)
- `silverrate.controller.ts` — Exports SilverRateController (~468 tok)
- `user.controller.ts` — Exports UserController (~1284 tok)
- `wishlist.controller.ts` — Exports WishlistController (~416 tok)

## src/middlewares/

- `auth.middleware.ts` — Exports AuthRequest, protect, admin (~425 tok)
- `error.middleware.ts` — Exports errorMiddleware (~476 tok)

## src/models/

- `cart.model.ts` — Exports ICartItem, ICart, Cart (~336 tok)
- `coupon.model.ts` — Exports ICoupon, Coupon (~297 tok)
- `filterConfig.model.ts` — Exports IPriceRange, IFilterConfig, FilterConfig (~270 tok)
- `giftVoucher.model.ts` — Exports IGiftVoucher, GiftVoucher (~250 tok)
- `metalrate.model.ts` — Exports MetalType, IMetalRate, MetalRate (~287 tok)
- `order.model.ts` — Exports IOrderItem, IShippingAddress, IOrder, Order (~1078 tok)
- `pincodeRate.model.ts` — Exports IPincodeRate, PincodeRate (~175 tok)
- `pricingConfig.model.ts` — Exports IPricingConfig, PricingConfig (~167 tok)
- `product.model.ts` — Exports IProductImage, IProduct, Product (~605 tok)
- `return.model.ts` — Exports IReturnItem, IReturn, Return (~437 tok)
- `review.model.ts` — Exports IReview, Review (~239 tok)
- `savings.model.ts` — Exports ISavingsPayment, ISavings, Savings (~475 tok)
- `silverrate.model.ts` — Exports ISilverRate, SilverRate (~258 tok)
- `user.model.ts` — Exports IAddress, IUser, User (~555 tok)
- `wishlist.model.ts` — Exports IWishlistItem, IWishlist, Wishlist (~210 tok)

## src/repositories/

- `cart.repository.ts` — Exports CartRepository (~506 tok)
- `coupon.repository.ts` — Exports CouponRepository (~534 tok)
- `filterConfig.repository.ts` — Exports FilterConfigRepository (~221 tok)
- `giftVoucher.repository.ts` — Exports GiftVoucherRepository (~565 tok)
- `inventory.repository.ts` — Create the stock document only if it does not exist yet (lazy seed from the (~1493 tok)
- `metalrate.repository.ts` — Exports MetalRateUpsertParams, MetalRateRepository (~556 tok)
- `order.repository.ts` — Exports OrderRepository (~1110 tok)
- `pincodeRate.repository.ts` — Exports PincodeRateRepository (~242 tok)
- `pricingConfig.repository.ts` — Current GST percent, falling back to the 3% default when unset. (~241 tok)
- `product.repository.ts` — Exports ProductRepository (~1894 tok)
- `return.repository.ts` — Exports ReturnRepository (~582 tok)
- `review.repository.ts` — Exports IReview, ReviewRepository (~822 tok)
- `savings.repository.ts` — Exports SavingsRepository (~609 tok)
- `silverrate.repository.ts` — Exports SilverRateRepository (~385 tok)
- `user.repository.ts` — Exports AddressData, IUserWithPassword, UserRepository (~1125 tok)
- `wishlist.repository.ts` — Exports WishlistRepository (~412 tok)

## src/routes/

- `admin.routes.ts` — API routes: GET, POST, PUT, DELETE (12 endpoints) (~11610 tok)
- `auth.routes.ts` — API routes: POST (4 endpoints) (~827 tok)
- `cart.routes.ts` — API routes: GET, POST, DELETE (3 endpoints) (~660 tok)
- `coupon.routes.ts` — API routes: POST (1 endpoints) (~300 tok)
- `delivery.routes.ts` — API routes: GET (1 endpoints) (~480 tok)
- `giftVoucher.routes.ts` — API routes: GET (1 endpoints) (~252 tok)
- `health.routes.ts` — API routes: GET (1 endpoints) (~226 tok)
- `index.ts` — Declares router (~530 tok)
- `metalrate.routes.ts` — API routes: GET (2 endpoints) (~382 tok)
- `misc.routes.ts` — API routes: POST (1 endpoints) (~559 tok)
- `order.routes.ts` — API routes: POST, GET (4 endpoints) (~1052 tok)
- `payment.routes.ts` — API routes: POST (2 endpoints) (~588 tok)
- `pricingConfig.routes.ts` — API routes: GET (1 endpoints) (~211 tok)
- `product.routes.ts` — API routes: GET, POST, DELETE (7 endpoints) (~1817 tok)
- `return.routes.ts` — API routes: POST, GET (2 endpoints) (~1342 tok)
- `savings.routes.ts` — API routes: POST, GET (3 endpoints) (~1982 tok)
- `shipping.routes.ts` — API routes: GET, POST, DELETE (3 endpoints) (~1004 tok)
- `silverrate.routes.ts` — API routes: GET (2 endpoints) (~692 tok)
- `storeConfig.routes.ts` — API routes: GET (1 endpoints) (~322 tok)
- `user.routes.ts` — API routes: GET, PUT, POST, DELETE (7 endpoints) (~1720 tok)
- `wishlist.routes.ts` — API routes: GET, POST, DELETE (3 endpoints) (~1144 tok)

## src/services/

- `cart.service.ts` — Exports CartService (~388 tok)
- `coupon.service.ts` — Exports CouponService (~640 tok)
- `giftVoucher.service.ts` — Public storefront list — active denominations only. (~571 tok)
- `metalrate.service.ts` — Exports MetalRateResponse, MetalRateUpsertInput, MetalRateService (~1000 tok)
- `order.service.ts` — Re-send the order confirmation email to the order owner. Authorised for the (~1664 tok)
- `payment.service.ts` — B2: Create a Razorpay order for an amount the SERVER computes from the cart (~2420 tok)
- `pricing.service.ts` — Resolve a product's `purity` field (e.g. "925", "999", "92.5", "Silver 925") (~3167 tok)
- `product.service.ts` — Attach live stock from the Inventory collection (source of truth). Falls (~3319 tok)
- `return.service.ts` — Exports ReturnService (~293 tok)
- `review.service.ts` — Exports ReviewService (~485 tok)
- `savings.service.ts` — Exports SavingsService (~506 tok)
- `silverrate.service.ts` — Exports LegacySilverRateResponse, SilverRateService (~524 tok)
- `stock.service.ts` — Enforces product stock at order creation (I9). The `Inventory.currentStock` (~938 tok)
- `user.service.ts` — Exports UserService (~1968 tok)
- `wishlist.service.ts` — Exports WishlistService (~185 tok)

## src/tests/

- `address-book.api.test.ts` — Authenticated as a fixed user; admin guard unused here. (~858 tok)
- `admin-orders.api.test.ts` — API routes: POST, GET (3 endpoints) (~770 tok)
- `admin-products-frontend-shape.api.test.ts` — Stub the repository so the full validateCreatePayload logic runs but no DB call is made (~1107 tok)
- `admin-products.api.test.ts` — API routes: POST, PUT, DELETE (7 endpoints) (~1140 tok)
- `coupon-apply.api.test.ts` — API routes: POST (5 endpoints) (~793 tok)
- `pricing.service.test.ts` — Declares makeProduct (~776 tok)
- `review-delete.api.test.ts` — API routes: DELETE (4 endpoints) (~724 tok)

## src/utils/

- `appError.ts` — Exports AppError (~103 tok)
- `authCookie.ts` — Cookie-based JWT helpers. The token is issued in an httpOnly cookie so it is (~424 tok)
- `db.ts` — Exports connectMongo, disconnectMongo (~100 tok)
- `email.ts` — Exports EmailAddress, EmailAttachment, SendEmailInput, sendEmail (~777 tok)
- `emailNotifications.ts` — Map a persisted order document into the confirmation email payload, including (~4473 tok)
- `exportOpenapi.ts` — Write the generated OpenAPI spec to `openapi.json` in the project root. (~170 tok)
- `jwt.ts` — Exports generateToken (~65 tok)
- `logger.ts` — Declares levels (~308 tok)
- `migrateSqlToMongo.ts` — Migration script: SQL Server → MongoDB Atlas (~4450 tok)
- `seeder.ts` — Exports seedAdmin (~304 tok)
- `seedImages.ts` — Exports seedImages (~2571 tok)
- `seedInventory.ts` — One-time reconciliation: create an Inventory.currentStock document for every (~445 tok)
- `sql.ts` — Exports getSqlPool, closeSqlPool (~588 tok)
