# KV Silver Zone — Pre-Delivery Fixes & Required API Changes

This document tracks the production-readiness fixes for the storefront. Each item lists the
**frontend change** (done in this repo) and any **backend / API change** the server team must
implement before launch.

> **Update 2026-06-14 (round 2):** Backend reports the API is complete. The deferred frontend
> halves (I5 cookie auth, B2 create-order payload, I7 gift vouchers) plus the new GST config (#9)
> are now implemented client-side. See **"Field-name assumptions to confirm"** at the bottom —
> a few server response shapes were parsed defensively and should be verified.

Legend: ✅ done · 🟡 frontend done, backend pending · ⬜ not started

---

## 🔴 Blockers

### B1 — Shop search crashes the page ✅
- **Symptom:** Typing in the Shop search box threw `ReferenceError: setSelectedPriceRanges is not defined`.
- **Root cause:** `handleSearchChange` called `setSelectedPriceRanges([])` (plural) but the state
  setter is `setSelectedPriceRange` (singular string).
- **Frontend fix:** `src/pages/Shop.tsx` — `setSelectedPriceRanges([])` → `setSelectedPriceRange('')`.
- **Backend change:** none.
- **Status:** ✅ Fixed. Typecheck clean.

### B2 — Order total is computed on the client and trusted by the server 🟡
- **Risk:** Price tampering. The browser computes `subtotal + tax − discount` and sends it as the
  amount to charge. A user can edit it in devtools and pay less.
- **Current contract (must change):**
  - `POST /payments/create-order` accepts a client `amount`.
  - `POST /payments/verify` accepts `orderData.totalAmount` and per-item `price` from the client.
- **Required backend changes (MANDATORY before launch):**
  1. `POST /payments/create-order` must accept **only** `{ items: [{ product, quantity }], couponCode? }`
     and compute the Razorpay order amount server-side from the DB price × quantity, server-side
     tax, and server-validated coupon. Return the authoritative `{ id, amount, currency }`.
  2. `POST /payments/verify` must **recompute** the order total from `items` (product + quantity)
     and the coupon on the server. Ignore any client-supplied `price` / `totalAmount`. Reject if
     the verified Razorpay payment amount ≠ server-computed amount.
  3. Persist the server-computed totals on the order, not the client values.
- **Frontend changes (this repo):** ✅ DONE
  - `POST /payments/create-order` now sends `{ items:[{product,quantity,isGiftVoucher?,giftVoucherId?}],
    couponCode?, pincode? }` — no client amount. Razorpay handler uses the server-returned `amount`/`id`.
  - Cart line items carry `isGiftVoucher` + `giftVoucherId` into both create-order and `/payments/verify`.
- **Status:** ✅ Frontend done (server already recomputes server-side per backend).

### B3 — Product prices not tied to the live silver rate 🟡
- **Gap:** Core business logic. `ProductDetail` shows a static breakdown
  (`price / 1.03 * 0.75`) and never reads `silverRateService`. For a silver store, price should
  derive from `weight (g) × live rate/g + making charge + GST`.
- **Required backend changes:**
  - Products should expose the inputs needed to price by weight: `weightInGrams`, `purity`
    (e.g. `925`), and `makingChargePercent` (or `makingChargePerGram`).
  - **Authoritative price must be computed server-side** at add-to-cart / checkout using the
    current silver rate (see B2 — the server is the source of truth for money).
  - Decide policy: is the catalog price fixed at listing time, or recomputed live? Recommend
    **live compute server-side**, with the displayed price refreshed from `GET /silver-rates/today`.
- **Frontend changes (this repo):** ✅ DONE
  - `ProductDetail.tsx` now **prefers the server-computed breakdown** (`product.pricing`:
    `metalValue`, `makingCharge`, `ratePerGram`, `basis`) and `product.weightInGrams`.
  - Falls back to a live `silverRateService.getTodayRate()` × weight estimate, then a 75/25 split.
  - GST % is read from `/pricing-config` (see #9), not hardcoded.
- **Status:** ✅ Done. Authoritative charged amount is owned by the server (B2).

### B4 — No real form validation (zod present but unused) ✅
- **Gap:** Login, Signup, Payment address, Contact, Profile relied on HTML5 `required` only.
- **Frontend changes (this repo):** ✅ DONE
  - Added `src/lib/validation.ts` with zod schemas (email, Indian phone `^[6-9]\d{9}$`,
    PIN `^\d{6}$`, names, password rules) + a `validateForm()` helper returning `{ success, errors }`.
  - Wired into **Login, Signup, Payment, Contact, Profile** — inline per-field errors, submit
    blocked until valid, `aria-invalid` on inputs.
- **Backend change:** none required, but the server should still validate independently.
- **Status:** ✅ Done. Typecheck + 16 tests green.

---

## 🟠 Important gaps

### I5 — JWT stored in localStorage (XSS token theft) ✅ (cookie auth adopted)
- **Decision:** httpOnly cookie. Backend sets/clears the auth cookie on login/logout.
- **Frontend changes (this repo):** ✅ DONE
  - `api.ts` sends `credentials: 'include'` on every request; **removed** the `Authorization`
    header and the `kv-silver-token` localStorage read/writes.
  - `AuthContext`: `logout()` calls `POST /auth/logout` (server clears the cookie) then drops local
    state; login/signup ignore the response `token`; session restored via cookie-authenticated
    `/users/me` when a stored user is present.
- **Deploy note (not code):** cross-origin cookie needs `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`
  (HTTPS), and an explicit `CORS_ORIGINS` allowlist (not `*`).
- **Status:** ✅ Frontend done.

### I6 — No route-level auth guards ✅
- **Gap:** `/payment`, `/profile`, `/dashboard`, `/change-password`, `/wishlist` rendered for
  logged-out users.
- **Frontend change:** ✅ DONE — added `src/components/RequireAuth.tsx`; wrapped the five protected
  routes in `App.tsx`. Redirects to `/login` with the attempted path in `state.from`; `Login`
  returns the user there after success. Admin still self-guards.
- **Backend change:** none (server already 401s; this is UX).
- **Status:** ✅ Done.

### I7 — Gift Vouchers are a hardcoded static array ✅
- **Frontend changes (this repo):** ✅ DONE
  - New `src/services/giftVoucher.ts` fetches `GET /gift-vouchers`; `GiftVouchers.tsx` renders the
    API list (with loading/empty states) instead of the inline array.
  - Vouchers added to cart carry `isGiftVoucher: true` + `giftVoucherId`, which flow through to
    create-order and verify so the **server prices them** (client price ignored).
- **Status:** ✅ Done.

### I8 — Inconsistent loading / empty / error states 🟡
- **Frontend change:** ✅ Added `src/components/ErrorBoundary.tsx` wrapping the route tree in
  `App.tsx` — render errors now show a recoverable fallback instead of a blank screen.
- **Remaining:** standardize per-page loading/empty skeletons (incremental polish, not a blocker).
- **Backend change:** none.
- **Status:** 🟡 Error boundary done; per-page state polish remaining.

### I9 — No stock enforcement at checkout ✅ (frontend)
- **Backend change:** validate + atomically decrement stock at order creation (done per backend).
- **Frontend changes (this repo):** ✅ DONE
  - `product` normalizer reads `stockAvailable`/`inStock`; `inStock = stockAvailable > 0` when present.
  - `ProductCard` shows an "Out of Stock" badge and disables add-to-cart; `ProductDetail` already
    disables add-to-cart and shows availability.
- **Status:** ✅ Frontend done.

### #9 — GST hardcoded on the client (NEW, from backend round 2) ✅
- **Gap:** GST was hardcoded inconsistently — 3% in `CartContext`, **5%** in `Payment`, 3% in
  `ProductDetail`.
- **Frontend changes (this repo):** ✅ DONE
  - New `src/services/pricingConfig.ts` reads `GET /pricing-config` (safe 3% fallback).
  - `CartContext`, `Payment`, and `ProductDetail` now use `gstPercent` from the config for both the
    computed tax and the displayed label. Fixes the 3%/5% inconsistency.
- **Status:** ✅ Done.

---

## Backend API change summary (for the server team)

| # | Endpoint | Required change |
|---|----------|-----------------|
| B2 | `POST /payments/create-order` | Accept `{ items:[{product,quantity}], couponCode? }`; compute amount server-side; return authoritative amount. |
| B2 | `POST /payments/verify` | Recompute total from items+coupon server-side; ignore client `price`/`totalAmount`; verify charged == computed. |
| B3 | `GET /products/:id`, `GET /products` | Include `weightInGrams`, `purity`, `makingChargePercent`; compute authoritative price server-side from live rate. |
| I5 | `POST /auth/login`, `/logout` | Optionally issue/clear JWT via httpOnly cookie; accept cookie auth. |
| I7 | `GET /gift-vouchers` (or products) | Serve admin-configurable voucher denominations. |
| I9 | `POST /orders`, `/payments/verify` | Validate + atomically decrement stock; reject on insufficient inventory. |

---

## Field-name assumptions to confirm (round 2)

These response shapes were parsed **defensively** (multiple key fallbacks + safe defaults), so a
mismatch degrades gracefully rather than crashing — but please confirm so the live data renders:

| Endpoint | Frontend expects | Fallbacks tried | If wrong |
|----------|------------------|-----------------|----------|
| `GET /gift-vouchers` | array of `{ id/_id, name, amount, description, tag?, isActive }` | amount → `value` → `price` | wrong price/name shown |
| `GET /pricing-config` | `{ gstPercent: number }` | `gst` → `taxPercent` → `tax`; else **3%** | GST label/amount falls back to 3% |
| `GET /products/:id` pricing | `pricing: { metalValue, makingCharge, ratePerGram, basis }` + `weightInGrams` | falls back to live-rate estimate, then 75/25 | breakdown shows estimate, not server values |
| `GET /products` stock | `stockAvailable: number` (and/or `inStock: boolean`) | `inStock` → `isActive` → `true` | out-of-stock badge may not show |
| `POST /payments/create-order` | returns `{ id, amount, currency, breakdown? }` | — | Razorpay handler needs `id` + `amount` |
| line items | server reads `isGiftVoucher` + `giftVoucherId` on create-order & verify items | — | voucher mispriced |

## Delivery polish — round 3 (2026-06-14)

Done:
- ✅ **Saved address book** at checkout — `Payment.tsx` prefills from `localStorage` (`kv-silver-address`),
  with a "Save this address" checkbox; persisted on successful order (Razorpay + COD).
- ✅ **SEO meta/OG per route** — `react-helmet-async` + `src/components/Seo.tsx` (title, description,
  OG/Twitter, canonical). Applied to Index, Shop, ProductDetail (dynamic, `product` type), SilverRate,
  GiftVouchers, Contact (indexable) and Login/Signup/Payment/Profile (`noindex`). `HelmetProvider`
  wraps the app in `App.tsx`.
- ✅ **I9 cart surfacing** — `Cart.tsx` shows an out-of-stock label per item and disables checkout
  until such items are removed.
- ✅ **Per-change API contract docs** — see `docs/api/`.

Still open (need a decision / credentials — see question to product owner):
- **Downloadable invoice** — `InvoiceView.tsx` exists but isn't wired; needs a print/PDF approach
  (`react-to-print` vs `window.print()` — not currently a dependency).
- **Accessibility pass** — broad; scope TBD.
- **Checkout e2e tests** — needs a framework choice (Playwright vs Cypress; neither installed).
- **Analytics + error monitoring** — needs a provider + key (GA4 id / Sentry DSN).
- **I8 polish remainder** — key data pages already have loading/empty states + a global error
  boundary; remaining is cosmetic skeleton consistency.

Backend-owned, not this repo: deploy cookie/CORS env vars (I5 note); Mongoose duplicate-index
warning on `productId` in the inventory model.

## Delivery features — round 4 (2026-06-14)

- ✅ **Downloadable invoice** — `react-to-print` wired into `OrderTracking.tsx`; "Download Invoice"
  prints `InvoiceView` (off-screen) to PDF.
- ✅ **Analytics + error monitoring** — `src/lib/analytics.ts` (`@sentry/react` + GA4), env-gated
  (`VITE_SENTRY_DSN`, `VITE_GA4_ID`), no-op without keys. Init in `main.tsx`; SPA page views on
  route change. See `.env.example`.
- ✅ **Checkout/storefront e2e** — Playwright (`playwright.config.ts`, `e2e/storefront.spec.ts`):
  smoke + B1/B4/I6 regressions. Run `npm run test:e2e` (first run: `npx playwright install chromium`).
- ✅ **Accessibility quick wins** — aria-labels/aria-pressed/aria-expanded on icon-only buttons
  (ProductCard, Navbar, Cart, Payment, ProductDetail), `aria-live` on quantity, `aria-label` on
  the navbar search.

### openapi.json reconciliation — two real bugs fixed
The provided `openapi.json` revealed that my round-2 defensive parsing was wrong for two endpoints
(it degraded to fallback instead of reading live data):
- **`GET /gift-vouchers`** returns `{ status, data:[...] }` (not a bare array); fields are `label`
  + `amount` + `sortOrder`. `giftVoucher.ts` now reads `.data`, maps `label`/`amount`, sorts.
- **`GET /pricing-config`** returns `{ status, data:{ gstPercent } }` (not a bare object).
  `pricingConfig.ts` now reads `.data`.
- **`ProductPricing.basis`** is the enum `'live' | 'static'` (not a sentence) — `ProductDetail`
  now only shows the rate note when `basis === 'live'`.
All other shapes (create-order, verify, products stock/pricing) matched. Per-endpoint contracts in
`docs/api/` are now **verified against openapi.json**.

---

## Round 6 (2026-06-14) — address book + order email (backend now implemented)

- ✅ **Server-side address book** — `src/services/address.ts` (`/users/me/addresses` CRUD).
  `Payment.tsx`: authed users get a saved-address picker + default prefill; a new address is saved
  to the account on order success (dedup), guests keep localStorage.
- ✅ **Order confirmation email** — automatic server-side on order; `orderService.resendConfirmation`
  + a "Resend email" action on `OrderConfirmation.tsx`.
- Contracts verified against `openapi.json`; see `docs/api/addresses.md`.

_Last updated: 2026-06-14 (round 6). Update the status flags as each item lands._

---

## Push notifications (mobile app) — REQUIRED backend work

Added with the Capacitor Android app. The mobile client registers FCM device
tokens against the authenticated user. Backend work needed (see
`docs/push-notifications.md` for the full contract):

- `POST /users/me/push-tokens` — body `{ token, platform }` — store/refresh the device token for the current user (dedupe by token value; a token may move between users → last writer wins).
- `DELETE /users/me/push-tokens` — body `{ token }` — remove a token.
- Hold Firebase credentials (service account) to send via FCM. To deep-link on tap, include `data.route` (e.g. `/order/1234`) in the message payload.
- Prune tokens FCM reports as unregistered when sending.

Both endpoints are Bearer-authenticated on mobile (see the Bearer-token auth note for the Capacitor build).

---

## Delivery charges (zone-based) — REQUIRED backend work

Added a zone-based delivery-charge config (Chennai ₹150 / Other District ₹200 / Other State ₹250)
editable in the admin Shipping tab. Full contract in `docs/api/delivery-config.md`.

Backend work needed:

- `GET /delivery-config` (public) + `GET`/`PUT /admin/delivery-config` — persist `{ chennai, otherDistrict, otherState }` (non-negative numbers). Validate all three on PUT.
- **Money path (deferred until backend lockstep):** `POST /payments/create-order` must add the resolved zone charge to the authoritative `amount` and surface it in `breakdown` (e.g. `breakdown.deliveryCharge`). It needs the destination `city`/`state` (or must derive the zone from `pincode`). `verify`/COD order creation must apply the same charge server-side. Only then will `Payment.tsx` replace the hardcoded "Shipping: Free" line with the real charge and include it in the displayed total.
