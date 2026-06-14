# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-03

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

## Key Learnings

- **Project:** kv-api
- **Description:** A Node.js Express TypeScript API with a clean architecture.
- **Database:** MongoDB Atlas via Mongoose (NOT SQL Server — earlier project memory was stale; current codebase uses Mongoose models throughout).
- **Metal filter:** Products have a `purity` field (not a `metal` field). The `GET /products?metal=Silver,Gold+22K` filter matches against `purity` case-insensitively.
- **Role computation:** `role` field on User is optional. Service layer computes effective role: 'staff' if `role==='staff'`, 'admin' if `isAdmin===true`, else 'customer'. No breaking change for existing users.
- **Passbook numbers:** Generated as `PB-XXXXXXXX` using `countDocuments() + 1` zero-padded to 8 digits. Not race-condition-safe at extreme scale but fine for this use case.
- **GST calculation:** 3% GST on non-gift-voucher subtotal. `grandTotal = totalWithTax + deliveryFee`. Backend computes and stores all breakdowns independently of frontend.
- **Pincode rates:** Stored in MongoDB `PincodeRate` collection. Order service looks up delivery fee by pincode at order creation time.
- **Filter config:** Single global document in `FilterConfig` collection (key='global'), upserted on PUT.
- **Stall promo coupon:** Generated at signup when `stallEvent: true` — creates a 10% off single-use coupon, returns `promoCoupon` code in signup response.
- **Password-change policy:** Password update endpoint is `PUT /api/v1/users/:userId/password` (protected). Self updates are allowed; admin can update any user's password.
- **Full DB reset nuance:** For clearing MongoDB data, use `db.listCollections()` to enumerate all collections. `mongoose.connection.collections` only includes imported model collections.
- **Store config:** Store theme settings are persisted separately from filter settings. Admin endpoint is `/api/v1/admin/store-config` and accepts `{ theme: string, isDark: boolean }`.
- **Public store config read:** Frontend can read theme settings without auth from `GET /api/v1/store-config`.
- **Server-side pricing (B2/B3):** `src/services/pricing.service.ts` is the authoritative money engine. `computeCheckout({items:[{product,quantity}], couponCode?, pincode?})` recomputes prices from DB (never trusts client prices), applies GST on non-voucher subtotal, server-validated coupon, and pincode delivery fee. `POST /payments/create-order` and `/payments/verify` and `POST /orders` all route through it. Verify also fetches the Razorpay order and rejects if charged amount ≠ recomputed amount.
- **GST rate is admin-configurable** (added 2026-06-14). Stored in the single-doc `PricingConfig` collection (`gstPercent`, default 3). Pricing service reads it per checkout. Admin GET/PUT `/admin/pricing-config`; public read `GET /pricing-config` for display. Falls back to 3% when unset.
- **Order confirmation email** (added 2026-06-14): `sendOrderConfirmationEmail` + `buildOrderConfirmationInput(order, {userEmail,userName})` in `src/utils/emailNotifications.ts` build a rich email (line items, totals breakdown, shipping address, `FRONTEND_URL`-based order link). Sent automatically on order creation for BOTH razorpay and COD in `PaymentService.verifyAndCreateOrder`, and in `OrderService.createOrder`. Best-effort (logged, never thrown). Resend: `POST /orders/:id/resend-confirmation` (owner/admin via `OrderService.resendConfirmation`, in-memory 60s per-order throttle → 429). NOTE: `getOrderById` resolves the owner id from the populated `userId` doc (`order.userId._id`), not `order.userId.toString()` — the repo populates userId, so the old `.toString()` would have 403'd real owners.
- **Account address book** (added 2026-06-14): `User.addresses` subdocument array `{ _id, label?, firstName, lastName, address, city, state, pincode, phone, isDefault }`. CRUD at `/users/me/addresses` (`GET`/`POST`/`PUT/:id`/`DELETE/:id`, cookie auth). Responses map `_id`→`id`. Validation: PIN `^\d{6}$`, phone `^[6-9]\d{9}$` (matches frontend). First address auto-default; setting `isDefault` unsets others; deleting the default promotes the first remaining. Repo uses Mongoose `DocumentArray.id()` + subdoc `.deleteOne()`.
- **Cookie-based JWT auth** (added 2026-06-14). Login/signup set an httpOnly `token` cookie (`src/utils/authCookie.ts`); `protect` reads the cookie first, then the `Authorization: Bearer` header (kept for Swagger/API clients). `POST /auth/logout` clears it. No `cookie-parser` dependency — the cookie is parsed manually. CORS now sends `credentials: true` with reflected origin. Cross-site cookies need `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` (HTTPS) and explicit `CORS_ORIGINS`.
- **Live silver pricing (B3):** `computeUnitPrice(product, ratePerGram)` = weight × silver rate/g × purityFraction + making charge. Making charge from `makingChargePerGram` (preferred) or `makingChargePercent`. Falls back to static `product.price` when no rate / weight / making input. Product read endpoints (`GET /products`, `/products/:id`, `/products/featured`) are enriched with the live `price` + `pricing` breakdown.
- **Stock source of truth = `Inventory.currentStock`** (reconciled 2026-06-14). `src/services/stock.service.ts` enforces stock against the `Inventory` collection: it lazily seeds an inventory doc from `Product.quantity` on first checkout (`ensureStock`, `$setOnInsert`), decrements atomically via a conditional `$gte` filter (race-safe), rolls back partial reservations, and writes an `InventoryTransaction` OUT for audit. Product create seeds inventory; product read responses expose `stockAvailable`/`inStock` from Inventory (falling back to `Product.quantity` if no doc). `Product.quantity` is now just the seed/initial value — restocking is done via the admin inventory endpoints, NOT by editing the product. Run `npm run seed:inventory` once to backfill existing products. Admin controls catalog visibility separately via `isActive`.
- **Gift vouchers (I7):** `GiftVoucher` collection holds admin-configurable denominations. Public `GET /gift-vouchers` (active only); admin CRUD at `/admin/gift-vouchers`. In checkout, voucher line items must carry `isGiftVoucher:true` + a valid `giftVoucherId`; priced from the DB `amount`, excluded from GST and stock.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-04-05] Do not pass `req.params.<id>` directly where a strict `string` is required. Normalize `string | string[]` route params in controllers before service calls.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
- [2026-06-14] **B3 pricing policy = live compute server-side** (user choice). Price derives from the live silver rate at read/checkout time rather than being fixed at listing. Static `product.price` is kept only as a fallback when no rate/weight/making-charge inputs exist, so the store never breaks if today's rate is unset.
- [2026-06-14] **I9 stock superseded:** initially enforced against `Product.quantity`; user chose to reconcile onto `Inventory.currentStock` as the single source of truth, with admin controlling catalog visibility separately via `isActive`. StockService now decrements Inventory (lazy-seeded from product quantity), and product reads report Inventory stock. `npm run seed:inventory` backfills existing products.
- [2026-06-14] **GST rate made admin-configurable** (user choice) rather than hardcoded 3%. Stored in `PricingConfig`, read per checkout, default 3%.
- [2026-06-14] **Auth moved to httpOnly cookies** (user choice: "cookie based always"). Bearer header kept as fallback for non-browser clients. Implemented without cookie-parser to avoid a new dependency.
- [2026-06-14] **Razorpay amount verification:** verify re-fetches the Razorpay order via REST and compares `amount` (paise) to the freshly recomputed total, closing the price-tampering loop end-to-end. No `razorpay` SDK — native `https`/`crypto`.
