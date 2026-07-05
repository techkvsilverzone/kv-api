# Inventory Management API Documentation

This document outlines the API endpoints required to support the Inventory Management UI.

## Core Endpoints

### 1. Stock Inward
Record new stock arriving in inventory (e.g. supplier restock, returns). This should increase the total product stock and save an audit log transaction.

- **URL:** `/api/admin/inventory/inward`
- **Method:** `POST`
- **Auth required:** Yes (Admin/Staff only)
- **Request Body:**
  ```json
  {
    "productId": "string",
    "quantity": 50,
    "reason": "Supplier delivery"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Stock inward recorded successfully",
    "transaction": {
      "id": "tx_123",
      "type": "IN",
      "productId": "string",
      "quantity": 50,
      "reason": "Supplier delivery",
      "date": "2023-11-20T10:00:00Z"
    }
  }
  ```

### 2. Stock Outward
Record manual reduction of stock (e.g. damages, shrinkage, or manual overrides). This should decrease the total product stock and save an audit log transaction.

- **URL:** `/api/admin/inventory/outward`
- **Method:** `POST`
- **Auth required:** Yes (Admin/Staff only)
- **Request Body:**
  ```json
  {
    "productId": "string",
    "quantity": 2,
    "reason": "Damaged during transit"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Stock outward recorded successfully",
    "transaction": {
      "id": "tx_124",
      "type": "OUT",
      "productId": "string",
      "quantity": 2,
      "reason": "Damaged during transit",
      "date": "2023-11-20T11:00:00Z"
    }
  }
  ```

### 3. Inventory Ledger / Transactions
Fetch the historical log of all inventory movements.

- **URL:** `/api/admin/inventory/transactions`
- **Method:** `GET`
- **Auth required:** Yes (Admin/Staff only)
- **Query Params (Optional):**
  - `productId`: Filter by specific product
  - `type`: Filter by "IN" or "OUT"
  - `limit`: Pagination limit
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "transactions": [
      {
        "id": "tx_124",
        "type": "OUT",
        "productId": "p123",
        "productName": "Silver Ring 925",
        "quantity": 2,
        "reason": "Damaged during transit",
        "date": "2023-11-20T11:00:00Z",
        "performedBy": "user_id_here"
      },
      {
        "id": "tx_123",
        "type": "IN",
        "productId": "p123",
        "productName": "Silver Ring 925",
        "quantity": 50,
        "reason": "Supplier delivery",
        "date": "2023-11-20T10:00:00Z",
        "performedBy": "user_id_here"
      }
    ]
  }
  ```

---

## Recommended Additional / Advanced Endpoints

### 4. Stock Reconciliation
Set the absolute stock number (calculated after a physical count). The backend calculates the difference between current DB stock and the new physical count, and automatically posts the appropriate `IN` or `OUT` adjustment.

- **URL:** `/api/admin/inventory/reconcile`
- **Method:** `POST`
- **Auth required:** Yes (Admin/Staff only)
- **Request Body:**
  ```json
  {
    "productId": "string",
    "physicalCount": 48,
    "reason": "Monthly audit"
  }
  ```

### 5. Low-Stock Alerts
Fetch products that are dropping below their stock thresholds for re-ordering dashboards.

- **URL:** `/api/admin/inventory/low-stock`
- **Method:** `GET`
- **Auth required:** Yes (Admin/Staff only)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "lowStockItems": [
      {
        "productId": "p89",
        "productName": "Silver Bangle",
        "currentStock": 3,
        "threshold": 5
      }
    ]
  }
  ```

### 6. Inventory Summary & Analytics
Fetch aggregated data about inventory health. Useful for administrative dashboards.

- **URL:** `/api/admin/inventory/summary`
- **Method:** `GET`
- **Auth required:** Yes (Admin/Staff only)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "totalItemsInStock": 1450,
    "lowStockCount": 12,
    "outOfStockCount": 3,
    "recentMovements": 45
  }
  ```

> **Note on Fetching Current Stock:** 
> A dedicated endpoint to fetch current stock for a specific product is not listed here because your existing `GET /api/products` (and `GET /api/products/:id`) responses should organically include a `stock` or `quantity` field representing the updated balance. It's recommended to maintain this behavior.
