# KV Silver Zone — API Changes Plan

> Companion to `page_implementation_plan.md`.  
> Covers every backend change needed to fully support the UI features built in the implementation plan.

---

## Overview

Six UI features introduced in the implementation plan require backend support:

| # | Feature | UI Location | Current State | Change Type |
|---|---------|-------------|---------------|-------------|
| 1 | Gift wrap & message on orders | Cart → Payment | UI-only state, never sent | **New fields on existing endpoint** |
| 2 | Single-order fetch by ID | OrderConfirmation | Fetches all orders then filters | **New endpoint** |
| 3 | Order navigation after payment | Payment | Navigates to `/order/:id` (tracking) | **Route change + redirect** |
| 4 | Product price breakdown fields | ProductDetail | Estimated 75/25 split client-side | **New fields on Product model** |
| 5 | Pincode delivery checker | ProductDetail | Mocked with setTimeout | **New endpoint** |
| 6 | Sale products filter | Offers page | Filters client-side by `isSale\|\|originalPrice` | **New query param on existing endpoint** |

---

## 1. Gift Wrap & Message on Orders

### Problem
`Cart.tsx` lets users toggle gift wrap (₹99 fee) and write a personalized message. These values are local `useState` and are never passed to the Payment page or included in the order creation payload.

### Required Changes

**`src/services/payment.ts` — `PaymentVerificationPayload`**
```ts
orderData: {
  // ... existing fields ...
  couponCode?: string;
  giftWrap?: boolean;       // ADD
  giftMessage?: string;     // ADD
  giftWrapFee?: number;     // ADD — send 99 when giftWrap is true, 0 otherwise
};
```

**`src/pages/Payment.tsx`**  
- Accept `giftWrap`, `giftMessage`, `giftWrapFee` as route state passed from Cart (via `navigate('/payment', { state: { giftWrap, giftMessage } })`) or from a shared context/store.
- Include these in both the Razorpay `handler` `orderData` and the COD `verifyPayment` call.
- Reflect `giftWrapFee` in the order summary price breakdown.

**Backend — Order model**
```
giftWrap:    Boolean, default: false
giftMessage: String,  maxLength: 200, optional
giftWrapFee: Number,  default: 0
```

**Backend — `POST /payments/verify`**  
Accept and persist `giftWrap`, `giftMessage`, `giftWrapFee` in the created Order document. Include them in the order response so the Order Confirmation and Order Tracking pages can surface them.

**Backend — `POST /orders` (direct order creation)**  
Same as above — add the three fields to the `CreateOrderPayload` schema.

---

## 2. Single-Order Fetch by ID

### Problem
`OrderConfirmation.tsx` calls `orderService.getMyOrders()` (fetches the entire order list) and then filters for the matching ID. This is wasteful and breaks if the user has many orders or the order is very new.

### Required Changes

**`src/services/order.ts` — add `getOrderById`**
```ts
getOrderById: async (id: string): Promise<Order> => {
  const order = await api.get<Order>(`/orders/${id}`);
  return normalizeOrder(order);
},
```

**`src/pages/OrderConfirmation.tsx`**  
Replace the `getMyOrders` query + `.find()` pattern with:
```ts
const { data: order } = useQuery({
  queryKey: ['order', id],
  queryFn: () => orderService.getOrderById(id!),
  enabled: !!id,
});
```

**Backend — `GET /orders/:id`**  
New authenticated endpoint. Returns the single order document if it belongs to the authenticated user (or if the user is admin). Returns `404` if not found, `403` if the order belongs to another user.

Response shape: same as the objects returned by `GET /orders/me` (normalized `id` field, full `items` array, `shippingAddress`, `status`, `giftWrap`, `giftMessage`, etc.).

---

## 3. Post-Payment Navigation to Order Confirmation

### Problem
After a successful payment, `Payment.tsx` navigates to `/order/:id` (the Order Tracking page). The new `/order-confirmation/:id` page was built specifically for the post-purchase moment, but the Payment page still ignores it.

### Required Changes

**`src/pages/Payment.tsx`**  
Change both navigation calls (Razorpay `handler` and COD success path):
```ts
// Before
navigate(`/order/${verifyResult.orderId}`);

// After
navigate(`/order-confirmation/${verifyResult.orderId}`);
```

No backend change required — `verifyResult.orderId` is already returned by `POST /payments/verify`.

---

## 4. Product Price Breakdown Fields

### Problem
`ProductDetail.tsx` estimates metal value as 75% and making charges as 25% of the pre-GST price. These are hardcoded approximations that will be wrong for coins, artifacts, or heavy pieces.

### Required Changes

**Backend — Product model**  
Add optional fields:
```
metalValue:     Number   // metal value component of price, pre-GST
makingCharges:  Number   // making charges component of price, pre-GST
```
Both are optional. Existing products that don't have them will continue to use the client-side 75/25 fallback.

**Backend — Product API responses**  
Include `metalValue` and `makingCharges` in `GET /products`, `GET /products/:id`, and `GET /products/featured`.

**`src/services/product.ts` — `Product` type (via `CartContext`)**  
Add optional fields to the `Product` interface:
```ts
metalValue?:    number;
makingCharges?: number;
```

**`src/pages/ProductDetail.tsx` — price breakdown logic**  
Update the breakdown to use real values when present, falling back to the 75/25 estimate:
```ts
const preGst = product.price / 1.03;
const metalValue    = product.metalValue    ?? Math.round(preGst * 0.75);
const makingCharges = product.makingCharges ?? Math.round(preGst * 0.25);
const gst           = Math.round(product.price - preGst);
```

**Admin panel — product create/edit form**  
Add `Metal Value (₹)` and `Making Charges (₹)` number inputs to the Add Product dialog in `Admin.tsx`.

---

## 5. Pincode Delivery Checker

### Problem
The pincode checker in `ProductDetail.tsx` uses `setTimeout` and always returns "available". It provides no real information.

### Required Changes

**Backend — `GET /delivery/check`**  
New public endpoint (no auth required).

Query params:
```
pincode: string (required, 6 digits)
```

Response:
```json
{
  "available": true,
  "estimatedDays": "5-7",
  "courierPartner": "BlueDart",
  "cod": true
}
```

Or when unavailable:
```json
{
  "available": false,
  "reason": "Remote area — serviceable via manual arrangement"
}
```

Implementation options (choose one):
- **Static list**: Maintain a JSON/CSV of non-serviceable pincodes (e.g. remote Andaman & Nicobar, Lakshadweep) and return `false` for those, `true` for all others.
- **Courier API integration**: Call BlueDart / DTDC / Shiprocket serviceability API and cache results for 24h.

**`src/services/product.ts` (or a new `src/services/delivery.ts`)**
```ts
export const deliveryService = {
  checkPincode: async (pincode: string): Promise<{
    available: boolean;
    estimatedDays?: string;
    courierPartner?: string;
    cod?: boolean;
    reason?: string;
  }> => {
    return api.get(`/delivery/check?pincode=${pincode}`);
  },
};
```

**`src/pages/ProductDetail.tsx` — `checkPincode` function**  
Replace the `setTimeout` mock with:
```ts
const checkPincode = async () => {
  setPincodeChecking(true);
  setPincodeResult(null);
  try {
    const result = await deliveryService.checkPincode(pincode);
    setPincodeResult(result.available ? 'available' : 'unavailable');
    if (result.available) setDeliveryInfo(result); // show estimatedDays, courierPartner
  } catch {
    setPincodeResult('unavailable');
  } finally {
    setPincodeChecking(false);
  }
};
```

---

## 6. Sale Products Filter

### Problem
The Offers page (`Offers.tsx`) calls `productService.getProducts({ sortBy: 'newest' })` and then filters client-side by `p.isSale || p.originalPrice`. This loads every product and wastes bandwidth.

### Required Changes

**`src/services/product.ts` — `ProductFilters`**
```ts
export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest';
  onSale?: boolean;   // ADD
  featured?: boolean; // ADD — also useful for the homepage Featured Collection
}
```

**Backend — `GET /products`**  
Support two new query params:
- `onSale=true` → filter where `isSale === true || originalPrice != null`
- `featured=true` → filter where `isFeatured === true` (replaces the separate `/products/featured` endpoint or mirrors it)

**`src/pages/Offers.tsx`**  
```ts
const { data: discountedProducts = [], isLoading } = useQuery({
  queryKey: ['sale-products'],
  queryFn: () => productService.getProducts({ onSale: true }),
});
// Remove the client-side .filter() call — backend now handles it
```

---

## Summary of New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/orders/:id` | Required | Fetch a single order by ID |
| `GET` | `/delivery/check?pincode=` | None | Check pincode serviceability |

## Summary of Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/payments/verify` | Accept `giftWrap`, `giftMessage`, `giftWrapFee` in `orderData` |
| `POST` | `/orders` | Accept `giftWrap`, `giftMessage`, `giftWrapFee` |
| `GET` | `/orders/me` | Include `giftWrap`, `giftMessage` in response objects |
| `GET` | `/orders/:id` | *(new)* Include `giftWrap`, `giftMessage` in response |
| `GET` | `/products` | Accept `onSale` and `featured` query params |
| `GET` | `/products/:id` | Include `metalValue`, `makingCharges` in response |
| `GET` | `/products/featured` | Include `metalValue`, `makingCharges` in response |

## Summary of Model Changes

| Model | Field | Type | Notes |
|-------|-------|------|-------|
| Order | `giftWrap` | Boolean | Default `false` |
| Order | `giftMessage` | String | Max 200 chars, optional |
| Order | `giftWrapFee` | Number | Default `0` |
| Product | `metalValue` | Number | Optional, pre-GST rupees |
| Product | `makingCharges` | Number | Optional, pre-GST rupees |

## Frontend-Only Changes (No Backend Required)

These were noted in the implementation plan but need no API support:

- **Theme customization** (`Admin.tsx`) — purely client-side CSS variable manipulation.
- **Recently Viewed** (`useRecentlyViewed` hook + `RecentlyViewed.tsx`) — uses `localStorage` only; cross-device persistence is not in scope.
- **FAQ / Privacy Policy / Terms & Conditions** — all static content pages.
- **Offers campaigns** (`Offers.tsx`) — campaign cards are hardcoded; a future `GET /campaigns` endpoint can make these dynamic, but is out of scope for this plan.
- **Dark/Light mode toggle** (`Admin.tsx`) — toggles the `dark` CSS class on `<html>`; no API involved.
