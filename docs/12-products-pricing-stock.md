# `GET /products` and `GET /products/:id` — pricing & stock fields

The client reads new fields for the live price breakdown and stock badges. All are optional and
degrade gracefully.

## Added fields
```jsonc
{
  // …existing product fields…
  "stockAvailable": 7,        // remaining units (number)
  "inStock": true,            // optional explicit flag
  "weightInGrams": 12.5,      // numeric weight for the breakdown basis line
  "pricing": {                // server-computed price breakdown (display) — verified
    "basis": "live",          // enum: "live" | "static"
    "metalValue": 9000,
    "makingCharge": 2500,
    "ratePerGram": 72,        // nullable
    "purityFraction": 0.925,
    "currency": "INR"
  }
}
```

`/products` returns a **bare array**; `/products/{id}` a bare object (no `{ status, data }` wrapper).
Also available: `listedPrice` (static fallback), `makingChargePercent`, `makingChargePerGram`.

## Client behaviour
- **Stock:** `inStock` is derived as `stockAvailable > 0` when `stockAvailable` is present;
  otherwise falls back to the explicit `inStock`, then `isActive`, then `true`. Out-of-stock shows
  a badge and disables add-to-cart (`ProductCard`, `ProductDetail`).
- **Pricing breakdown (`ProductDetail`):** prefers `pricing.metalValue` + `pricing.makingCharge`
  (GST = `price − metalValue − makingCharge`); shows `weightInGrams × pricing.ratePerGram` and the
  `basis` note. Falls back to a live silver-rate estimate, then a 75/25 split.

> Display only — the server remains the source of truth for the charged amount.

## Confirm these fields
- `stockAvailable` (number) and/or `inStock` (bool) names.
- `pricing.{metalValue,makingCharge,ratePerGram,basis}` and `weightInGrams` names.
