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

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-04-05] Do not pass `req.params.<id>` directly where a strict `string` is required. Normalize `string | string[]` route params in controllers before service calls.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
