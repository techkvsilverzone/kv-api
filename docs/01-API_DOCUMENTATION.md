# KV Silver Zone API Documentation

This document is aligned with the current implementation in `src/routes` and controller responses.

## Base Configuration
- **Base URL**: `http://localhost:5000/api/v1`
- **Content-Type**: `application/json`
- **CORS**: Enabled for all origins (`*`)
- **Protected routes** require JWT Bearer token.
  - Header: `Authorization: Bearer <JWT_TOKEN>`

---

## 1) Health

### Get API health
- **Endpoint**: `GET /health`
- **Auth**: No
- **Response (200)**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-02-26T07:48:37.774Z"
  }
  ```

---

## 2) Authentication

### Signup
- **Endpoint**: `POST /auth/signup`
- **Auth**: No
- **Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePassword123",
    "phone": "9876543210"
  }
  ```
- **Response (201)**:
  ```json
  {
    "user": {
      "_id": "53ABEE9B-E212-F111-8669-00155D70AF54",
      "email": "john@example.com",
      "name": "John Doe",
      "phone": "9876543210",
      "isAdmin": false,
      "createdAt": "2026-02-26T07:13:12.321Z",
      "updatedAt": "2026-02-26T07:13:12.321Z"
    },
    "token": "<JWT_TOKEN>"
  }
  ```

### Login
- **Endpoint**: `POST /auth/login`
- **Auth**: No
- **Body**:
  ```json
  {
    "email": "admin@kvsilverzone.com",
    "password": "Admin@123"
  }
  ```
- **Response (200)**:
  ```json
  {
    "user": {
      "_id": "53ABEE9B-E212-F111-8669-00155D70AF54",
      "email": "admin@kvsilverzone.com",
      "name": "System Admin",
      "phone": "9999999999",
      "address": "Admin Office, Silver Zone",
      "city": "Chennai",
      "state": "Tamil Nadu",
      "pincode": "600001",
      "isAdmin": true,
      "createdAt": "2026-02-26T07:13:12.321Z",
      "updatedAt": "2026-02-26T07:13:12.321Z"
    },
    "token": "<JWT_TOKEN>"
  }
  ```

### Forgot password
- **Endpoint**: `POST /auth/forgot-password`
- **Auth**: No
- **Body**:
  ```json
  {
    "email": "admin@kvsilverzone.com"
  }
  ```
- **Response (200)**:
  ```json
  {
    "message": "Password reset link sent to your email"
  }
  ```

---

## 3) User Profile (Protected)

### Get current user
- **Endpoint**: `GET /users/me`
- **Auth**: Yes
- **Response (200)**:
  ```json
  {
    "_id": "53ABEE9B-E212-F111-8669-00155D70AF54",
    "email": "admin@kvsilverzone.com",
    "name": "System Admin",
    "phone": "9999999999",
    "address": "Admin Office, Silver Zone",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "pincode": "600001",
    "isAdmin": true,
    "createdAt": "2026-02-26T07:13:12.321Z",
    "updatedAt": "2026-02-26T07:13:12.321Z"
  }
  ```

### Update current user
- **Endpoint**: `PUT /users/me`
- **Auth**: Yes
- **Body** (any profile fields):
  ```json
  {
    "name": "System Admin Updated",
    "phone": "9999999998",
    "city": "Chennai"
  }
  ```
- **Response (200)**: Updated user object (same shape as `GET /users/me`).

---

## 4) Products

### List products
- **Endpoint**: `GET /products`
- **Auth**: No
- **Query Params**:
  - `category`
  - `search`
  - `minPrice`
  - `maxPrice`
  - `sortBy` = `price_asc` | `price_desc` | `newest`
- **Response (200)**: Array of product variants.

### Featured products
- **Endpoint**: `GET /products/featured`
- **Auth**: No
- **Response (200)**: Array of product variants (latest 10 by current implementation).

### Product categories
- **Endpoint**: `GET /products/categories`
- **Auth**: No
- **Response (200)**:
  ```json
  {
    "status": "success",
    "data": ["999 Silver", "Silver", "Silver plated"]
  }
  ```

### Product by id
- **Endpoint**: `GET /products/:id`
- **Auth**: No
- **Path Param**: `id` is product `imageId` (numeric string, e.g. `1`).
- **Response (200)**: Single product variant object.

#### Product object shape
```json
{
  "_id": "1",
  "id": "1",
  "imageId": 1,
  "productGroup": "AGAL-01",
  "variant": "Top view",
  "quantity": 1,
  "weightGm": 19.75,
  "currency": "INR",
  "name": "Agal Villaku",
  "price": 1850,
  "image": "",
  "category": "Silver",
  "material": "Silver",
  "weight": "19.75 gm",
  "purity": "Silver",
  "description": "Agal Villaku - Top view",
  "inStock": true,
  "isNewItem": false,
  "isSale": false,
  "sortOrder": 1
}
```

---

## 5) Cart (Protected)

### Get cart
- **Endpoint**: `GET /cart`
- **Auth**: Yes
- **Response (200)**:
  - Empty cart:
    ```json
    {
      "items": []
    }
    ```
  - Non-empty cart:
    ```json
    {
      "_id": "<cartId>",
      "user": "<userId>",
      "items": [
        {
          "product": { "_id": "2", "name": "Design Bowl", "price": 1450 },
          "quantity": 1
        }
      ],
      "createdAt": "2026-02-26T07:13:12.321Z",
      "updatedAt": "2026-02-26T07:13:12.321Z"
    }
    ```

### Add or update cart item
- **Endpoint**: `POST /cart/items`
- **Auth**: Yes
- **Body**:
  ```json
  {
    "productId": "2",
    "quantity": 2
  }
  ```
- **Response (200)**: Updated cart object.

### Remove cart item
- **Endpoint**: `DELETE /cart/items/:id`
- **Auth**: Yes
- **Path Param**: `id` = product `imageId` string.
- **Response (200)**: Updated cart object.

---

## 6) Orders (Protected)

### Create order
- **Endpoint**: `POST /orders`
- **Auth**: Yes
- **Body**:
  ```json
  {
    "items": [
      {
        "product": "2",
        "name": "Design Bowl - Front view",
        "price": 1450,
        "quantity": 1,
        "image": ""
      }
    ],
    "shippingAddress": {
      "firstName": "John",
      "lastName": "Doe",
      "address": "123 Street",
      "city": "Mumbai",
      "state": "MH",
      "pincode": "400001",
      "phone": "9876543210"
    },
    "paymentMethod": "card",
    "totalAmount": 5000
  }
  ```
- **Notes**:
  - `tax` is computed server-side (`totalAmount * 0.05`).
- **Response (201)**: Created order object.

### Get my orders
- **Endpoint**: `GET /orders/me`
- **Auth**: Yes
- **Response (200)**: Array of order objects.

#### Order object shape
```json
{
  "_id": "<orderId>",
  "user": "<userId>",
  "items": [
    {
      "_id": "<orderItemId>",
      "product": "2",
      "name": "Design Bowl - Front view",
      "price": 1450,
      "quantity": 1,
      "image": ""
    }
  ],
  "totalAmount": 2550,
  "tax": 127.5,
  "status": "Pending",
  "shippingAddress": {
    "firstName": "Test",
    "lastName": "Customer",
    "address": "12 Temple Street",
    "city": "Madurai",
    "state": "Tamil Nadu",
    "pincode": "625001",
    "phone": "9876543210"
  },
  "paymentMethod": "upi",
  "createdAt": "2026-02-26T07:13:12.321Z",
  "updatedAt": "2026-02-26T07:13:12.321Z"
}
```

---

## 7) Savings (Protected)

### Enroll in savings scheme
- **Endpoint**: `POST /savings/enroll`
- **Auth**: Yes
- **Body**:
  ```json
  {
    "monthlyAmount": 2000,
    "duration": 12,
    "startDate": "2026-03-01"
  }
  ```
- **Response (201)**:
  ```json
  {
    "_id": "<savingsEnrollmentId>",
    "user": "<userId>",
    "monthlyAmount": 2000,
    "duration": 12,
    "startDate": "2026-03-01T00:00:00.000Z",
    "status": "Active",
    "totalPaid": 0,
    "bonusAmount": 0,
    "createdAt": "2026-02-26T07:13:12.321Z"
  }
  ```

### Get my schemes
- **Endpoint**: `GET /savings/my-schemes`
- **Auth**: Yes
- **Response (200)**: Array of savings enrollment objects.

---

## 8) Admin Operations (Protected + Admin)

### Get dashboard stats
- **Endpoint**: `GET /admin/stats`
- **Auth**: Yes (admin)
- **Response (200)**:
  ```json
  {
    "totalRevenue": 2550,
    "totalOrders": 1,
    "totalProducts": 26
  }
  ```

### Get all orders
- **Endpoint**: `GET /admin/orders`
- **Auth**: Yes (admin)
- **Response (200)**: Array of order objects where `user` includes `{ _id, name, email }`.

### Get all users
- **Endpoint**: `GET /admin/users`
- **Auth**: Yes (admin)
- **Response (200)**: Array of user objects.

### Create product
- **Endpoint**: `POST /admin/products`
- **Auth**: Yes (admin)
- **Body (minimum practical)**:
  ```json
  {
    "productGroup": "NEW-01",
    "name": "New Item",
    "variant": "Front view",
    "quantity": 1,
    "weightGm": 5.5,
    "material": "Silver",
    "price": 999,
    "image": ""
  }
  ```
- **Response (201)**: Created product variant object.

### Update product
- **Endpoint**: `PUT /admin/products/:id`
- **Auth**: Yes (admin)
- **Path Param**: `id` is product `imageId`.
- **Response (200)**: Updated product variant object.

### Delete product
- **Endpoint**: `DELETE /admin/products/:id`
- **Auth**: Yes (admin)
- **Path Param**: `id` is product `imageId`.
- **Response (204)**: No content.

### Update order status
- **Endpoint**: `PUT /admin/orders/:id/status`
- **Auth**: Yes (admin)
- **Body**:
  ```json
  {
    "status": "Shipped"
  }
  ```
- **Allowed values**: `Pending`, `Shipped`, `Delivered`, `Cancelled`
- **Response (200)**: Updated order object.

---

## 9) Misc

### Contact enquiry
- **Endpoint**: `POST /contact`
- **Auth**: No
- **Body**:
  ```json
  {
    "name": "QA",
    "email": "qa@example.com",
    "subject": "Test",
    "message": "Ping"
  }
  ```
- **Response (200)**:
  ```json
  {
    "message": "Message sent successfully"
  }
  ```

---

## Error Response Format
All errors follow this structure:
```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Error message description",
  "stack": "..."
}
```

`stack` appears only in development mode.

---

## Interactive Docs
- Swagger UI: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
- OpenAPI JSON: [http://localhost:5000/api-docs.json](http://localhost:5000/api-docs.json)
