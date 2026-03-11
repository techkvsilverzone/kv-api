# KV Silver Zone — Complete API Definition

This document defines every API endpoint, request DTO, and response DTO required by the KV Silver Zone frontend. The backend is expected to be built with **Node.js + Express + TypeScript + MongoDB (Mongoose)**.

> **Base URL**: `http://localhost:5000/api/v1`
>
> **Authentication**: Bearer JWT in the `Authorization` header.
> All **Protected** endpoints require a valid token. **Admin Only** endpoints additionally require `user.isAdmin === true`.

---

## Table of Contents

1. [Authentication & Users](#1-authentication--users)
2. [Products](#2-products)
3. [Product Reviews](#3-product-reviews)
4. [Cart](#4-cart-server-side)
5. [Coupons](#5-coupons)
6. [Payments (Razorpay)](#6-payments-razorpay)
7. [Orders](#7-orders)
8. [Savings Scheme](#8-savings-scheme)
9. [Wishlist](#9-wishlist)
10. [Silver Rates](#10-silver-rates)
11. [Returns & Refunds](#11-returns--refunds)
12. [Admin](#12-admin-operations)
13. [Contact](#13-contact)
14. [Common Models](#14-common-models)

---

## 1. Authentication & Users

### Models

```typescript
// ─── User ───
interface User {
  id: string;           // MongoDB _id
  email: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isAdmin: boolean;
  createdAt: string;    // ISO 8601
}

interface AuthResponse {
  user: User;
  token: string;        // JWT
}
```

### Endpoints

#### `POST /auth/signup`

Create a new user account.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name |
| `email` | string | Yes | Unique email |
| `password` | string | Yes | Min 6 characters |
| `phone` | string | No | Mobile number |

**Request**
```json
{
  "name": "Karthik V",
  "email": "karthik@example.com",
  "password": "securePass123",
  "phone": "+919876543210"
}
```

**Response `201 Created`**
```json
{
  "user": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "name": "Karthik V",
    "email": "karthik@example.com",
    "phone": "+919876543210",
    "isAdmin": false,
    "createdAt": "2025-06-01T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

#### `POST /auth/login`

Authenticate user and return JWT.

**Request**
```json
{
  "email": "karthik@example.com",
  "password": "securePass123"
}
```

**Response `200 OK`** — Same shape as signup's `AuthResponse`.

**Error `401`**
```json
{ "message": "Invalid email or password" }
```

---

#### `GET /users/me` — Protected

Returns the currently authenticated user's profile.

**Response `200 OK`** — `User` object.

---

#### `PUT /users/me` — Protected

Update profile fields.

**Request** (partial update)
```json
{
  "name": "Karthik Vel",
  "phone": "+919876543210",
  "address": "123 Silver Street",
  "city": "Chennai",
  "state": "Tamil Nadu",
  "pincode": "600001"
}
```

**Response `200 OK`** — Updated `User` object.

---

#### `POST /auth/forgot-password`

Initiate password reset (sends email).

**Request**
```json
{ "email": "karthik@example.com" }
```

**Response `200 OK`**
```json
{ "message": "Password reset link sent to your email" }
```

---

## 2. Products

### Models

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;           // URL or path
  category: string;        // "Necklaces" | "Bangles" | "Earrings" | "Rings" | "Anklets" | "Coins" | "Puja Items"
  weight: string;          // e.g. "45g"
  purity: string;          // "999" | "925" | "916"
  description: string;
  inStock: boolean;
  isNew?: boolean;
  isSale?: boolean;
  createdAt: string;
}

interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  limit?: number;
}
```

### Endpoints

#### `GET /products`

List products with optional filtering & pagination.

**Query Params**: Any key from `ProductFilters`.

**Response `200 OK`**
```json
[
  {
    "id": "665a...",
    "name": "Traditional Temple Necklace",
    "price": 15999,
    "originalPrice": 18999,
    "image": "/uploads/temple-necklace.jpg",
    "category": "Necklaces",
    "weight": "45g",
    "purity": "925",
    "description": "Handcrafted sterling silver temple necklace...",
    "inStock": true,
    "isNew": true,
    "isSale": true,
    "createdAt": "2025-06-01T10:00:00.000Z"
  }
]
```

---

#### `GET /products/featured`

Returns featured / new arrival products (used on homepage).

**Response `200 OK`** — `Product[]`

---

#### `GET /products/categories`

Returns the list of available product categories.

**Response `200 OK`**
```json
{
  "status": "success",
  "data": ["Necklaces", "Bangles", "Earrings", "Rings", "Anklets", "Coins", "Puja Items"]
}
```

---

#### `GET /products/:id`

Single product by ID.

**Response `200 OK`** — `Product`

**Error `404`**
```json
{ "message": "Product not found" }
```

---

## 3. Product Reviews

### Models

```typescript
interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;       // 1-5
  title: string;
  comment: string;
  createdAt: string;
}

interface ProductReviewSummary {
  averageRating: number;
  totalReviews: number;
  reviews: Review[];
}
```

### Endpoints

#### `GET /products/:productId/reviews`

Get all reviews for a product.

**Response `200 OK`**
```json
{
  "averageRating": 4.5,
  "totalReviews": 12,
  "reviews": [
    {
      "id": "665b...",
      "productId": "665a...",
      "userId": "664c...",
      "userName": "Karthik",
      "rating": 5,
      "title": "Beautiful necklace",
      "comment": "Stunning craftsmanship, exactly as shown.",
      "createdAt": "2025-06-05T14:30:00.000Z"
    }
  ]
}
```

---

#### `POST /products/:productId/reviews` — Protected

Submit a new review.

**Request**
```json
{
  "productId": "665a...",
  "rating": 5,
  "title": "Beautiful necklace",
  "comment": "Stunning craftsmanship, exactly as shown."
}
```

**Response `201 Created`** — `Review`

---

#### `DELETE /products/:productId/reviews/:reviewId` — Admin Only

Delete a review.

**Response `204 No Content`**

---

## 4. Cart (Server-Side)

### Models

```typescript
interface CartItem {
  product: Product;       // Populated product reference
  quantity: number;
}

interface Cart {
  items: CartItem[];
}
```

### Endpoints

#### `GET /cart` — Protected

Retrieve the authenticated user's cart.

**Response `200 OK`**
```json
{
  "items": [
    {
      "product": { "id": "665a...", "name": "Temple Necklace", "price": 15999, "image": "..." },
      "quantity": 2
    }
  ]
}
```

---

#### `POST /cart/items` — Protected

Add or update a product in the cart.

**Request**
```json
{
  "productId": "665a...",
  "quantity": 2
}
```

**Response `200 OK`** — Updated `Cart`

---

#### `DELETE /cart/items/:productId` — Protected

Remove a product from the cart entirely.

**Response `200 OK`** — Updated `Cart`

---

## 5. Coupons

### Models

```typescript
interface Coupon {
  id: string;
  code: string;                         // Unique, uppercase
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  validFrom: string;                    // ISO 8601
  validTo: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

interface ApplyCouponResponse {
  valid: boolean;
  discount: number;     // Actual discount amount in ₹
  message: string;
}
```

### Endpoints

#### `POST /coupons/apply` — Protected

Validate and calculate a coupon discount.

**Request**
```json
{
  "code": "SILVER20",
  "orderAmount": 15000
}
```

**Response `200 OK`**
```json
{
  "valid": true,
  "discount": 3000,
  "message": "Coupon applied! You save ₹3,000"
}
```

**Response `200 OK` (invalid)**
```json
{
  "valid": false,
  "discount": 0,
  "message": "Coupon has expired"
}
```

---

#### `GET /admin/coupons` — Admin Only

List all coupons.

**Response `200 OK`** — `Coupon[]`

---

#### `POST /admin/coupons` — Admin Only

Create a new coupon.

**Request**
```json
{
  "code": "SILVER20",
  "description": "20% off on all silver jewelry",
  "discountType": "percentage",
  "discountValue": 20,
  "minOrderAmount": 5000,
  "maxDiscount": 5000,
  "validFrom": "2025-06-01",
  "validTo": "2025-12-31",
  "usageLimit": 100
}
```

**Response `201 Created`** — `Coupon`

---

#### `PUT /admin/coupons/:id` — Admin Only

Update a coupon (partial update supported).

**Request** — `Partial<Coupon>`

**Response `200 OK`** — Updated `Coupon`

---

#### `DELETE /admin/coupons/:id` — Admin Only

Delete a coupon.

**Response `204 No Content`**

---

## 6. Payments (Razorpay)

### Models

```typescript
interface RazorpayOrderPayload {
  amount: number;       // Amount in paise (e.g., 1599900 for ₹15,999)
  currency?: string;    // Default: "INR"
  receipt?: string;     // Optional tracking ID
}

interface RazorpayOrder {
  id: string;           // Razorpay order_id (e.g., "order_ABC123")
  amount: number;
  currency: string;
  receipt: string;
  status: string;       // "created"
}

interface PaymentVerificationPayload {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  orderData: {
    items: OrderItem[];
    shippingAddress: ShippingAddress;
    paymentMethod: string;
    totalAmount: number;
    couponCode?: string;
  };
}

interface PaymentVerificationResponse {
  success: boolean;
  orderId: string;      // Created order's ID
  message: string;
}
```

### Endpoints

#### `POST /payments/create-order` — Protected

Create a Razorpay order for the given amount.

> **Backend**: Uses `razorpay.orders.create()` with the Razorpay Node SDK.

**Request**
```json
{
  "amount": 1679900,
  "currency": "INR"
}
```

**Response `201 Created`**
```json
{
  "id": "order_ABC123XYZ",
  "amount": 1679900,
  "currency": "INR",
  "receipt": "rcpt_665a1b2c",
  "status": "created"
}
```

---

#### `POST /payments/verify` — Protected

Verify the Razorpay payment signature and create the order.

> **Backend**: Verify `razorpay_signature` using `crypto.createHmac('sha256', secret).update(razorpayOrderId + '|' + razorpayPaymentId).digest('hex')`.
> If valid, create the order in DB. If a `couponCode` is provided, increment the coupon's `usedCount`.

**Request**
```json
{
  "razorpayOrderId": "order_ABC123XYZ",
  "razorpayPaymentId": "pay_DEF456",
  "razorpaySignature": "abcdef1234567890...",
  "orderData": {
    "items": [
      {
        "product": "665a...",
        "name": "Temple Necklace",
        "price": 15999,
        "quantity": 1,
        "image": "/uploads/temple-necklace.jpg"
      }
    ],
    "shippingAddress": {
      "firstName": "Karthik",
      "lastName": "V",
      "address": "123 Silver Street",
      "city": "Chennai",
      "state": "Tamil Nadu",
      "pincode": "600001",
      "phone": "+919876543210"
    },
    "paymentMethod": "razorpay",
    "totalAmount": 16799,
    "couponCode": "SILVER20"
  }
}
```

**Response `200 OK`**
```json
{
  "success": true,
  "orderId": "665c...",
  "message": "Payment verified and order created successfully"
}
```

**Response `400 Bad Request`**
```json
{
  "success": false,
  "orderId": "",
  "message": "Payment verification failed — signature mismatch"
}
```

> **Note for COD**: When `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature` are all empty strings and `paymentMethod` is `"cod"`, skip verification and create the order directly with status `"Pending"`.

---

## 7. Orders

### Models

```typescript
interface OrderItem {
  product: string;      // Product ID
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  tax: number;
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  shippingAddress: ShippingAddress;
  paymentMethod: string;    // "razorpay" | "cod"
  razorpayPaymentId?: string;
  couponCode?: string;
  couponDiscount?: number;
  createdAt: string;
  updatedAt: string;
}
```

### Endpoints

#### `POST /orders` — Protected

Create a new order directly (fallback without Razorpay).

**Request**
```json
{
  "items": [ { "product": "665a...", "name": "Temple Necklace", "price": 15999, "quantity": 1, "image": "..." } ],
  "shippingAddress": { "firstName": "Karthik", "lastName": "V", "address": "...", "city": "Chennai", "state": "Tamil Nadu", "pincode": "600001", "phone": "+919876543210" },
  "paymentMethod": "cod",
  "totalAmount": 16799
}
```

**Response `201 Created`** — `Order`

---

#### `GET /orders/me` — Protected

Get all orders for the authenticated user.

**Response `200 OK`** — `Order[]` (sorted by `createdAt` descending)

---

#### `GET /orders/:id` — Protected

Get a single order's full details.

**Response `200 OK`** — `Order`

---

## 8. Savings Scheme

### Models

```typescript
interface SavingsEnrollment {
  _id: string;
  user: string;           // User ID or populated user name
  monthlyAmount: number;
  duration: number;       // 6, 11, or 12 months
  startDate: string;
  status: 'Active' | 'Completed' | 'Defaulted';
  totalPaid: number;
  bonusAmount: number;    // For 11-month: 1 month bonus
  payments: SavingsPayment[];
  createdAt: string;
}

interface SavingsPayment {
  id: string;
  amount: number;
  paidDate: string;
  month: number;          // Which month (1-12)
  status: 'Paid' | 'Pending' | 'Overdue';
}
```

### Endpoints

#### `POST /savings/enroll` — Protected

Enroll in a savings scheme.

**Request**
```json
{
  "monthlyAmount": 5000,
  "duration": 11,
  "startDate": "2025-07-01"
}
```

**Response `201 Created`**
```json
{
  "_id": "665d...",
  "user": "665a...",
  "monthlyAmount": 5000,
  "duration": 11,
  "startDate": "2025-07-01",
  "status": "Active",
  "totalPaid": 0,
  "bonusAmount": 5000,
  "createdAt": "2025-06-15T10:00:00.000Z"
}
```

---

#### `GET /savings/my-schemes` — Protected

Returns the user's savings scheme enrollments.

**Response `200 OK`** — `SavingsEnrollment[]`

---

#### `POST /savings/:schemeId/pay` — Protected

Record a monthly payment for a savings scheme.

**Request**
```json
{
  "amount": 5000,
  "month": 3
}
```

**Response `200 OK`** — Updated `SavingsEnrollment`

---

## 9. Wishlist

### Models

```typescript
interface WishlistItem {
  product: Product;     // Populated
}

interface Wishlist {
  items: WishlistItem[];
}
```

### Endpoints

#### `GET /wishlist` — Protected

Get the user's wishlist with populated products.

**Response `200 OK`**
```json
{
  "items": [
    {
      "product": { "id": "665a...", "name": "Temple Necklace", "price": 15999, "image": "...", "category": "Necklaces", "weight": "45g", "purity": "925", "description": "...", "inStock": true }
    }
  ]
}
```

---

#### `POST /wishlist/items` — Protected

Add a product to the wishlist.

**Request**
```json
{ "productId": "665a..." }
```

**Response `200 OK`** — Updated `Wishlist`

---

#### `DELETE /wishlist/items/:productId` — Protected

Remove a product from the wishlist.

**Response `200 OK`** — Updated `Wishlist`

---

## 10. Silver Rates

### Models

```typescript
interface SilverRate {
  id: string;
  date: string;           // ISO 8601 date
  ratePerGram: number;
  ratePerKg: number;      // Auto-calculated: ratePerGram × 1000
  purity: string;         // "999" | "925" | "916"
  updatedBy?: string;     // Admin user name
  createdAt: string;
}
```

### Endpoints

#### `GET /silver-rates/today`

Get today's silver rates across all purities (public endpoint).

**Response `200 OK`**
```json
[
  {
    "id": "665e...",
    "date": "2025-06-15",
    "ratePerGram": 98,
    "ratePerKg": 98000,
    "purity": "999",
    "createdAt": "2025-06-15T08:00:00.000Z"
  },
  {
    "id": "665f...",
    "date": "2025-06-15",
    "ratePerGram": 90,
    "ratePerKg": 90000,
    "purity": "925",
    "createdAt": "2025-06-15T08:00:00.000Z"
  }
]
```

---

#### `GET /silver-rates/history?days=30`

Get historical silver rates.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | number | 30 | Number of days of history |

**Response `200 OK`** — `SilverRate[]`

---

#### `GET /admin/silver-rates` — Admin Only

Get all silver rate records.

**Response `200 OK`** — `SilverRate[]`

---

#### `POST /admin/silver-rates` — Admin Only

Update / create today's rate for a purity.

> **Backend**: If today's rate for the given purity already exists, update it. Otherwise, create a new record. Auto-compute `ratePerKg = ratePerGram × 1000`.

**Request**
```json
{
  "ratePerGram": 98,
  "purity": "999"
}
```

**Response `201 Created`** — `SilverRate`

---

## 11. Returns & Refunds

### Models

```typescript
interface ReturnRequest {
  id: string;
  orderId: string;
  userId: string;
  userName?: string;
  reason: string;         // "Damaged" | "Wrong Item" | "Quality Issue" | "Changed Mind" | "Other"
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  refundAmount: number;
  items: ReturnItem[];
  createdAt: string;
  updatedAt: string;
}

interface ReturnItem {
  product: string;        // Product ID
  name: string;
  quantity: number;
  price: number;
}
```

### Endpoints

#### `POST /returns` — Protected

Create a return request for an order.

**Request**
```json
{
  "orderId": "665c...",
  "reason": "Quality Issue",
  "description": "The silver appears tarnished on arrival.",
  "items": [
    { "product": "665a...", "name": "Temple Necklace", "quantity": 1, "price": 15999 }
  ]
}
```

**Response `201 Created`** — `ReturnRequest`

---

#### `GET /returns/me` — Protected

Get all return requests for the authenticated user.

**Response `200 OK`** — `ReturnRequest[]`

---

#### `GET /admin/returns` — Admin Only

Get all return requests across all users.

**Response `200 OK`** — `ReturnRequest[]`

---

#### `PUT /admin/returns/:id` — Admin Only

Update a return request's status.

**Request**
```json
{
  "status": "Approved",
  "refundAmount": 15999
}
```

**Response `200 OK`** — Updated `ReturnRequest`

---

## 12. Admin Operations

### Endpoints

#### `GET /admin/stats` — Admin Only

Dashboard summary statistics.

**Response `200 OK`**
```json
{
  "totalRevenue": 523400,
  "totalOrders": 87,
  "totalProducts": 42,
  "totalCustomers": 156,
  "recentOrders": [ "...first 5 orders..." ]
}
```

---

#### `GET /admin/users` — Admin Only

List all registered users.

**Response `200 OK`** — `User[]`

---

#### `GET /admin/orders` — Admin Only

List all orders in the system.

**Response `200 OK`** — `Order[]`

---

#### `PUT /admin/orders/:id/status` — Admin Only

Update an order's status.

**Request**
```json
{ "status": "Shipped" }
```

**Response `200 OK`** — Updated `Order`

---

#### `GET /admin/savings` — Admin Only

List all savings scheme enrollments across all users.

**Response `200 OK`** — `SavingsEnrollment[]` (with user info populated)

---

#### `POST /admin/products` — Admin Only

Create a new product.

**Request**
```json
{
  "name": "Designer Silver Bangles Set",
  "price": 8999,
  "originalPrice": null,
  "image": "/uploads/bangles.jpg",
  "category": "Bangles",
  "weight": "35g",
  "purity": "925",
  "description": "Elegant set of 4 sterling silver bangles...",
  "inStock": true
}
```

**Response `201 Created`** — `Product`

---

#### `PUT /admin/products/:id` — Admin Only

Update a product (partial update supported).

**Request** — `Partial<Product>`

**Response `200 OK`** — Updated `Product`

---

#### `DELETE /admin/products/:id` — Admin Only

Delete a product.

**Response `204 No Content`**

---

## 13. Contact

#### `POST /contact`

Submit a contact enquiry (public, no auth required).

**Request**
```json
{
  "name": "Priya",
  "email": "priya@example.com",
  "subject": "Bulk order inquiry",
  "message": "I'd like to inquire about bulk silver coin purchases for corporate gifting."
}
```

**Response `200 OK`**
```json
{ "message": "Thank you for contacting us. We'll get back to you shortly." }
```

---

## 14. Common Models

### Error Response

All error responses follow this shape:

```typescript
interface ErrorResponse {
  message: string;
  errors?: Record<string, string>;   // Optional field-level validation errors
}
```

**Examples**:
```json
{ "message": "Unauthorized" }
{ "message": "Validation failed", "errors": { "email": "Email is required", "password": "Password must be at least 6 characters" } }
```

### Pagination (optional enhancement)

For list endpoints that support pagination:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

---

## Environment Variables (Backend)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | Token expiry (e.g., "7d") |
| `RAZORPAY_KEY_ID` | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret |
| `FRONTEND_URL` | Frontend URL for CORS (e.g., "http://localhost:5173") |
| `SMTP_HOST` | Email service host (for password reset) |
| `SMTP_PORT` | Email service port |
| `SMTP_USER` | Email username |
| `SMTP_PASS` | Email password |

## Frontend Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (default: "http://localhost:5000/api/v1") |
| `VITE_RAZORPAY_KEY_ID` | Razorpay public key ID for checkout |
