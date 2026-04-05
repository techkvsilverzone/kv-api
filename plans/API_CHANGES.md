# KV Silver Zone — API Changes Required

This document lists every backend change needed to support the frontend features implemented in this chat session. Changes are grouped by domain.

---

## 1. Product Filtering — Metal Filter Support

**Affected endpoint:** `GET /products`

**Change:** Add `metal` as an optional query parameter that filters products by their metal type.

| Parameter | Type | Description |
|-----------|------|-------------|
| `metal` | `string` | Comma-separated metal types. Return products matching **any** of the values (OR). Example: `metal=Silver,Gold+22K` |

**Existing parameters (unchanged):**
- `category` — already supports comma-separated OR filtering
- `minPrice`, `maxPrice`, `search`, `sortBy` — unchanged

**Notes:**
- `metal` should match against the product's `purity` field (or a dedicated `metal` field if one exists).
- Matching should be case-insensitive.
- When `metal` is omitted, return all metals (no change to current behaviour).

---

## 2. RBAC — User Role Field

**Affected endpoint:** `GET /users/me` and `POST /auth/login` response body

**Change:** Include an explicit `role` field on the User object returned by the API.

**Current shape (assumed):**
```json
{
  "_id": "...",
  "name": "...",
  "email": "...",
  "isAdmin": true
}
```

**Required shape:**
```json
{
  "_id": "...",
  "name": "...",
  "email": "...",
  "isAdmin": true,
  "role": "admin"
}
```

| Value | Who gets it |
|-------|-------------|
| `"admin"` | Full access — all admin tabs including Theme, Revenue stats |
| `"staff"` | Partial access — can manage orders, products, coupons, savings, returns, silver rates, shipping, filters. Cannot see Revenue stat or Theme tab. |
| `"customer"` | No admin access |

**Notes:**
- The frontend falls back gracefully: if `role` is absent, it derives role from `isAdmin` (admin if true, else customer). Add `role` when ready — no breaking change.
- Staff users should be created/promoted via admin panel or directly in the database until a Staff management UI is built.

---

## 3. Savings Scheme — Passbook Number

**Affected endpoint:** `POST /savings/enroll` and `GET /savings/my-schemes` response

**Change:** Include a `passbookNumber` field on each `SavingsEnrollment` object.

**Required field:**
```json
{
  "_id": "...",
  "passbookNumber": "PB-00123456",
  "schemeId": "...",
  "startDate": "2026-04-05T00:00:00.000Z",
  "duration": 12,
  "monthlyAmount": 500,
  "status": "active"
}
```

**Notes:**
- The frontend currently falls back to `_id.slice(-8).toUpperCase()` as the passbook number when this field is absent. Add the field when ready.
- Recommended format: `PB-` prefix + zero-padded sequential number, e.g. `PB-00000042`.

---

## 4. Savings Scheme — Multi-Enrollment

**Affected endpoint:** `POST /savings/enroll`

**Change:** Allow a user to enroll in the same scheme multiple times. Each enrollment should create a separate `SavingsEnrollment` document with its own `passbookNumber`.

**Current behaviour (assumed):** Returns 409 Conflict if user already has an active enrollment in the same scheme.

**Required behaviour:** Always create a new enrollment regardless of existing ones.

**Notes:**
- If the current backend enforces uniqueness via a MongoDB index on `(userId, schemeId)`, remove or relax that index.
- The frontend no longer checks for existing enrollments before calling enroll.

---

## 5. Shipping — Pincode Delivery Rates

**New endpoints needed:**

### `GET /shipping/pincode-rates`
Returns the current pincode-to-delivery-fee mapping.

**Response:**
```json
{
  "status": "success",
  "data": [
    { "pincode": "600001", "label": "Chennai Central", "rate": 50 },
    { "pincode": "600006", "label": "Mylapore", "rate": 50 }
  ]
}
```

### `POST /shipping/pincode-rates`
Add a new pincode rate.

**Request body:**
```json
{ "pincode": "600020", "label": "Adyar", "rate": 60 }
```

### `DELETE /shipping/pincode-rates/:pincode`
Remove a pincode rate by pincode string.

**Notes:**
- Currently these rates are stored in-memory (`localStorage`) on the frontend. Persisting them server-side enables the rates to work across sessions and devices.
- Access should be restricted to `admin` and `staff` roles.
- Checkout (`POST /orders`) should read the delivery fee from this table using the customer's shipping pincode, and include it as `deliveryFee` in the order total.

---

## 6. Shop Filter Configuration

**New endpoints needed (optional — currently stored in `localStorage`):**

### `GET /admin/filter-config`
Returns the current shop filter configuration managed by admin/staff.

**Response:**
```json
{
  "status": "success",
  "data": {
    "hiddenCategories": ["Anklets"],
    "metals": ["Silver", "Gold 22K", "Platinum"],
    "priceRanges": [
      { "label": "Under ₹500", "value": "0-500" },
      { "label": "₹500 - ₹1,000", "value": "500-1000" },
      { "label": "₹1,000 - ₹2,000", "value": "1000-2000" },
      { "label": "Above ₹5,000", "value": "5000+" }
    ]
  }
}
```

### `PUT /admin/filter-config`
Replace the entire filter config (admin/staff only).

**Request body:** Same shape as the `data` object above.

**Notes:**
- Until this endpoint exists, config is stored in `localStorage['kv-filter-config']` on the admin's browser. Changes only take effect on the same browser.
- Moving this server-side is recommended for multi-device/multi-staff consistency.

---

## 7. GST / Tax — Order Total Fields

**Affected endpoint:** `POST /orders` (create order) and `GET /orders/:id`

**Change:** Include tax breakdown fields in the order document.

**Required fields on Order:**
```json
{
  "subtotal": 1000,
  "taxAmount": 30,
  "totalWithTax": 1030,
  "deliveryFee": 50,
  "grandTotal": 1080,
  "items": [...]
}
```

| Field | Calculation |
|-------|-------------|
| `subtotal` | Sum of `price × quantity` for all non-gift-voucher items |
| `taxAmount` | `subtotal × 0.03` (GST 3%) |
| `totalWithTax` | `subtotal + taxAmount` |
| `deliveryFee` | From pincode rate table (see §5) |
| `grandTotal` | `totalWithTax + deliveryFee` |

**Notes:**
- Gift voucher line items (`isGiftVoucher: true`) are GST-exempt and must not be included in the taxable subtotal.
- The frontend already computes `taxAmount` and `totalWithTax` in `CartContext` for display. The backend should independently validate and store these values.

---

## 8. Offline Stall — Auto-Credit Promo Coupon

**Affected endpoint:** `POST /auth/register` (signup)

**Change:** When a new user registers with the `stallEvent: true` flag in the request body, automatically credit a promotional coupon to their account.

**Request body (new optional field):**
```json
{
  "name": "...",
  "email": "...",
  "password": "...",
  "stallEvent": true
}
```

**Backend action:**
1. Create the user account as normal.
2. If `stallEvent: true`, generate and credit one promotional coupon (e.g. 10% off, single use) to the new user.
3. Return the coupon code in the registration response so the frontend can display it.

**Notes:**
- Currently the frontend shows a "promo coupon applied" toast but does not actually send any flag to the backend. Wire up the `offlineStallActive` flag from `localStorage['kv-offline-stall']` to the signup API call when ready.
- Consider adding an `isStallRegistration` boolean field to the User document for analytics.
