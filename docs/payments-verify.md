# `POST /payments/verify`

Verifies the Razorpay signature and creates the order. Also used for the COD path (empty Razorpay
fields). The server must **recompute** the total from `items` + coupon and **ignore** any
client-supplied `price` / `totalAmount`.

## Request
```jsonc
{
  "razorpayOrderId": "order_xxx",   // empty string for COD
  "razorpayPaymentId": "pay_xxx",   // empty string for COD
  "razorpaySignature": "sig",       // empty string for COD
  "orderData": {
    "items": [
      {
        "product": "<productId>",
        "name": "…",
        "price": 0,                  // client value — server should IGNORE for pricing
        "quantity": 2,
        "image": "…",
        "isGiftVoucher": true,        // voucher lines only
        "giftVoucherId": "<voucherId>"// voucher lines only
      }
    ],
    "shippingAddress": { "firstName","lastName","address","city","state","pincode","phone" },
    "paymentMethod": "razorpay" | "cod",
    "totalAmount": 0,                // client value — server should IGNORE
    "couponCode": "DIWALI10"         // optional
  }
}
```

## Response (client depends on `orderId`)
```jsonc
{ "success": true, "orderId": "<orderId>", "message": "…" }
```

## Notes
- On `success`, the client clears the cart and navigates to `/order/<orderId>`.
- `price`/`totalAmount` are sent only because they're part of the existing payload shape; the server
  is the source of truth and must recompute.

## Confirm these fields
- Response returns `success` and `orderId`.
- Server ignores client `price`/`totalAmount` and prices vouchers from `giftVoucherId`.
