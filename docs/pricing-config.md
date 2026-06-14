# `GET /pricing-config`

Supplies storefront-wide pricing constants. Currently the client only needs the GST percentage,
which replaces three hardcoded values (Cart 3%, Payment 5%, ProductDetail 3%).

## Response (wrapped in `{ status, data }`) — verified against `openapi.json`
```jsonc
{ "status": "success", "data": { "gstPercent": 3 } }   // whole-number percent; 3 means 3%
```

## Client parsing
- Reads `res.data.gstPercent` (tolerates a bare object too).
- GST read order: `gstPercent` → `gst` → `taxPercent` → `tax`
- **Fallback: 3%** if the request fails or no field matches (the client never blocks on this).

## Used by
- `CartContext` — tax on non-gift-voucher items (display).
- `Payment` — order-summary tax line + label.
- `ProductDetail` — price-breakdown GST line + label.

> Display only — the authoritative tax is computed server-side at create-order/verify.

## Confirm these fields
- The GST field name (`gstPercent` preferred).
- Whether it's a whole number (`3`) or a fraction (`0.03`). The client expects a **whole number**.
