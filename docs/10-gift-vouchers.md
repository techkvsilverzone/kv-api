# `GET /gift-vouchers`

Returns the purchasable gift-voucher denominations. Replaces the previously hardcoded client array.
**Verified against `openapi.json`.**

## Response (wrapped in `{ status, data }`)
```jsonc
{
  "status": "success",
  "data": [
    {
      "_id": "<voucherId>",
      "label": "₹5000 Gift Card",   // display name
      "amount": 5000,                // denomination
      "description": "…",
      "imageBase64": "…",            // optional
      "isActive": true,              // inactive vouchers filtered out client-side
      "sortOrder": 1                 // client sorts ascending by this
    }
  ]
}
```

## Client parsing
- Reads `res.data` (tolerates a bare array too).
- **id:** `_id` → `id`
- **name:** `label` → `name` → `"<formatted price> Gift Voucher"`
- **price:** `amount` → `value` → `price`
- Filters out `isActive === false` / empty id; sorts by `sortOrder`.

## Checkout
When a voucher is added to the cart, the line item carries `isGiftVoucher: true` and
`giftVoucherId` into create-order and verify. The **server prices vouchers**; the client price is
display only. See [payments-create-order.md](payments-create-order.md).

## Confirm these fields
- The denomination field name (`amount` vs `value` vs `price`).
- `id`/`_id` and `isActive` presence.
