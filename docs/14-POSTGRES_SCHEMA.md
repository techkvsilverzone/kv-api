# PostgreSQL Schema Reference — `kvs_ecommerce`

> Introspected from the live PostgreSQL 17 database on 2026-08-16.
> **This file is documentation, not a migration.** The schema is owned and applied
> on the server; nothing here is executed by the application.
> Row counts are a point-in-time snapshot from the introspection, not a guarantee.
>
> Regenerate after any schema change so repository authors have an accurate
> reference, then run `npm run migration:verify` to confirm the code still matches.

## Conventions

- `id` is a BIGINT identity on every table and is the application's identifier.
  It is surfaced to services and clients as a **string** under the key `_id`.
- `legacy_mongo_id` records the source MongoDB ObjectId. It exists purely for
  migration reconciliation and troubleshooting — business logic must never read it.
- Money and weights are `numeric`; the pool parses them to JS numbers.
- Calendar days (`rate_date`, `date_of_birth`, …) are `date` and are read as
  `'YYYY-MM-DD'` strings so they cannot drift across timezones.
- Nested API shapes (product variants/images, cart items, order items, savings
  ledger, user addresses) are relational tables that the repositories reassemble
  into the nested objects the API has always returned.

## Tables

### cart_items  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  cart_id  bigint NOT NULL
  product_id  bigint NOT NULL
  product_group_code  character varying(100) NOT NULL
  product_name  character varying(300) NOT NULL
  quantity  integer NOT NULL
  weight  numeric(14,3) NOT NULL
  unit_price  numeric(14,2) NOT NULL
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### carts  (rows: 1)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  user_id  bigint NOT NULL
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### categories  (rows: 11)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  name  character varying(200) NOT NULL
  parent  character varying(200)
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### coupons  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  code  character varying(100) NOT NULL
  discount_type  character varying(20) NOT NULL
  discount_value  numeric(14,2) NOT NULL
  min_order_amount  numeric(14,2) NOT NULL DEFAULT 0
  max_uses  integer NOT NULL DEFAULT 0
  used_count  integer NOT NULL DEFAULT 0
  expiry_date  timestamp with time zone NOT NULL
  is_active  boolean NOT NULL DEFAULT true
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### delivery_config  (rows: 1)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  key  character varying(50) NOT NULL DEFAULT 'global'::character varying
  chennai  numeric(14,2) NOT NULL DEFAULT 150
  other_district  numeric(14,2) NOT NULL DEFAULT 200
  other_state  numeric(14,2) NOT NULL DEFAULT 250
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### filter_config  (rows: 1)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  key  character varying(50) NOT NULL DEFAULT 'global'::character varying
  hidden_categories  ARRAY NOT NULL DEFAULT '{}'::text[]
  metals  ARRAY NOT NULL DEFAULT '{}'::text[]
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### filter_price_ranges  (rows: 0)
  id  bigint NOT NULL
  filter_config_id  bigint NOT NULL
  label  character varying(200) NOT NULL
  value  character varying(200) NOT NULL
  sort_order  integer NOT NULL DEFAULT 0

### gift_vouchers  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  label  character varying(200) NOT NULL
  amount  numeric(14,2) NOT NULL
  description  text
  image_url  text
  is_active  boolean NOT NULL DEFAULT true
  sort_order  integer NOT NULL DEFAULT 1
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### inventory  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  product_id  bigint NOT NULL
  current_stock  integer NOT NULL DEFAULT 0
  stock_threshold  integer NOT NULL DEFAULT 5
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### inventory_transactions  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  type  character varying(10) NOT NULL
  product_id  bigint NOT NULL
  quantity  integer NOT NULL
  reason  text NOT NULL
  performed_by  bigint NOT NULL
  date  timestamp with time zone NOT NULL DEFAULT now()
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### invoice_config  (rows: 1)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  key  character varying(50) NOT NULL DEFAULT 'global'::character varying
  company_name  character varying(300) NOT NULL DEFAULT 'KV Silver Zone'::character varying
  gstin  character varying(100) NOT NULL DEFAULT ''::character varying
  company_address  text NOT NULL DEFAULT ''::text
  company_phone  character varying(50) NOT NULL DEFAULT ''::character varying
  company_email  character varying(320) NOT NULL DEFAULT ''::character varying
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### metal_rates  (rows: 3)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  rate_date  date NOT NULL
  metal  character varying(20) NOT NULL
  karat  integer
  rate_per_gram  numeric(14,4) NOT NULL
  rate_per_kg  numeric(14,2) NOT NULL
  updated_by  character varying(200)
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### order_items  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  order_id  bigint NOT NULL
  product_id  bigint
  product_group_code  character varying(100) NOT NULL
  product_name  character varying(300) NOT NULL
  quantity  integer NOT NULL
  weight  numeric(14,3) NOT NULL
  unit_price  numeric(14,2) NOT NULL
  total_price  numeric(14,2) NOT NULL
  is_gift_voucher  boolean NOT NULL DEFAULT false
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### orders  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  user_id  bigint NOT NULL
  invoice_number  character varying(100)
  status  character varying(50) NOT NULL
  payment_method  character varying(50) NOT NULL
  payment_status  character varying(50) NOT NULL DEFAULT 'Pending'::character varying
  razorpay_order_id  character varying(200)
  razorpay_payment_id  character varying(200)
  coupon_code  character varying(100)
  coupon_discount  numeric(14,2) NOT NULL DEFAULT 0
  gift_wrap  boolean NOT NULL DEFAULT false
  gift_message  character varying(200)
  gift_wrap_fee  numeric(14,2) NOT NULL DEFAULT 0
  subtotal  numeric(14,2) NOT NULL DEFAULT 0
  tax_amount  numeric(14,2) NOT NULL DEFAULT 0
  total_with_tax  numeric(14,2) NOT NULL DEFAULT 0
  delivery_fee  numeric(14,2) NOT NULL DEFAULT 0
  grand_total  numeric(14,2) NOT NULL DEFAULT 0
  total_amount  numeric(14,2) NOT NULL
  tax  numeric(14,2) NOT NULL DEFAULT 0
  shipping_name  character varying(200) NOT NULL
  shipping_phone  character varying(50) NOT NULL
  shipping_line1  text NOT NULL
  shipping_line2  text
  shipping_city  character varying(150) NOT NULL
  shipping_state  character varying(150) NOT NULL
  shipping_pincode  character varying(20) NOT NULL
  shipping_country  character varying(100) NOT NULL
  delivered_at  timestamp with time zone
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### otp_codes  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  identifier  character varying(320) NOT NULL
  purpose  character varying(100) NOT NULL DEFAULT 'login'::character varying
  code_hash  text NOT NULL
  attempts  integer NOT NULL DEFAULT 0
  consumed  boolean NOT NULL DEFAULT false
  expires_at  timestamp with time zone NOT NULL
  created_at  timestamp with time zone NOT NULL DEFAULT now()

### pincode_rates  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  pincode  character varying(20) NOT NULL
  label  character varying(200) NOT NULL
  rate  numeric(14,2) NOT NULL
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### pricing_config  (rows: 1)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  key  character varying(50) NOT NULL DEFAULT 'global'::character varying
  gst_percent  numeric(10,4) NOT NULL DEFAULT 3
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### product_images  (rows: 29)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  product_id  bigint NOT NULL
  variant_name  character varying(200) NOT NULL
  image_url  text NOT NULL
  sort_order  integer NOT NULL DEFAULT 0
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### product_variants  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  product_id  bigint NOT NULL
  label  character varying(200) NOT NULL
  weight  character varying(100) NOT NULL
  height  character varying(100)
  breadth  character varying(100)
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### products  (rows: 18)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  product_group_code  character varying(100) NOT NULL
  name  character varying(300) NOT NULL
  description  text
  material  character varying(100)
  category  character varying(200) NOT NULL
  subcategory  character varying(200)
  tags  ARRAY NOT NULL DEFAULT '{}'::text[]
  weight  numeric(14,3) NOT NULL
  price  numeric(14,2) NOT NULL
  original_price  numeric(14,2)
  purity  character varying(50)
  is_sale  boolean
  is_featured  boolean
  metal_value  numeric(14,2)
  making_charges  numeric(14,2)
  making_charge_percent  numeric(10,4)
  making_charge_per_gram  numeric(14,4)
  quantity  integer NOT NULL DEFAULT 0
  is_active  boolean NOT NULL DEFAULT true
  is_fixed_price  boolean
  making_charge_type  character varying(20)
  making_charge_value  numeric(14,4)
  wastage_type  character varying(20)
  wastage_value  numeric(14,4)
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### rate_status  (rows: 1)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  key  character varying(50) NOT NULL DEFAULT 'global'::character varying
  blocked  boolean NOT NULL DEFAULT false
  stale_metals  ARRAY NOT NULL DEFAULT '{}'::text[]
  checked_at  timestamp with time zone NOT NULL DEFAULT now()
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### return_items  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  return_id  bigint NOT NULL
  order_item_id  bigint
  product_name  character varying(300) NOT NULL
  quantity  integer NOT NULL
  reason  text
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### returns  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  order_id  bigint NOT NULL
  user_id  bigint NOT NULL
  reason  text
  description  text
  status  character varying(30) NOT NULL DEFAULT 'Pending'::character varying
  refund_amount  numeric(14,2) NOT NULL DEFAULT 0
  fault_type  character varying(30) NOT NULL
  video_status  character varying(30) NOT NULL DEFAULT 'not_required'::character varying
  video_reference_code  character varying(100)
  video_file_path  text
  video_mime_type  character varying(200)
  video_received_at  timestamp with time zone
  video_sender_phone  character varying(50)
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### reviews  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  product_id  bigint NOT NULL
  user_id  bigint NOT NULL
  rating  smallint NOT NULL
  comment  text
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### savings_accounts  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  user_id  bigint NOT NULL
  passbook_number  character varying(100)
  scheme_type  character varying(30) NOT NULL
  plan_id  bigint
  metal  character varying(20)
  plan_name  character varying(200) NOT NULL
  monthly_amount  numeric(14,2) NOT NULL
  duration  integer NOT NULL
  bonus_amount  numeric(14,2) NOT NULL DEFAULT 0
  total_paid  numeric(14,2) NOT NULL DEFAULT 0
  status  character varying(20) NOT NULL DEFAULT 'Active'::character varying
  start_date  timestamp with time zone NOT NULL DEFAULT now()
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### savings_cancellations  (rows: 0)
  id  bigint NOT NULL
  savings_account_id  bigint NOT NULL
  cancelled_at  timestamp with time zone NOT NULL DEFAULT now()
  amount_paid_at_cancellation  numeric(14,2) NOT NULL
  penalty_percent  numeric(10,4) NOT NULL
  penalty_amount  numeric(14,2) NOT NULL
  gifts_value_deducted  numeric(14,2) NOT NULL DEFAULT 0
  net_redeemable  numeric(14,2) NOT NULL
  note  text
  cancelled_by  bigint NOT NULL
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### savings_maturity_benefits  (rows: 0)
  id  bigint NOT NULL
  savings_account_id  bigint NOT NULL
  gold_coin_value  numeric(14,2)
  gold_grams  numeric(14,3)
  gold_rate_per_gram  numeric(14,4)
  silver_grams  numeric(14,3)
  silver_value  numeric(14,2)
  silver_rate_per_gram  numeric(14,4)
  gifts_value  numeric(14,2)
  gifts  ARRAY NOT NULL DEFAULT '{}'::text[]
  computed_at  timestamp with time zone
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### savings_payments  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  savings_account_id  bigint NOT NULL
  month  integer NOT NULL
  amount  numeric(14,2) NOT NULL DEFAULT 0
  paid_at  timestamp with time zone NOT NULL DEFAULT now()
  material_rate  numeric(14,4) NOT NULL DEFAULT 0
  material_weight  numeric(14,3) NOT NULL DEFAULT 0
  devident_amount  numeric(14,2) NOT NULL DEFAULT 0
  devident_material_rate  numeric(14,4) NOT NULL DEFAULT 0
  devident_material_weight  numeric(14,3) NOT NULL DEFAULT 0
  method  character varying(20) NOT NULL DEFAULT 'ONLINE'::character varying
  razorpay_order_id  character varying(200)
  razorpay_payment_id  character varying(200)
  recorded_by  bigint
  due_month_key  character varying(7)
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### scheme_plan_monthly_amounts  (rows: 0)
  id  bigint NOT NULL
  scheme_plan_id  bigint NOT NULL
  amount  numeric(14,2) NOT NULL
  sort_order  integer NOT NULL DEFAULT 0

### scheme_plans  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  type  character varying(30) NOT NULL
  name  character varying(200) NOT NULL
  description  text
  is_active  boolean NOT NULL DEFAULT true
  metal  character varying(20)
  duration_months  integer NOT NULL
  bonus_months  integer NOT NULL DEFAULT 0
  passbook_prefix  character varying(50) NOT NULL
  payment_due_day_of_month  smallint
  early_exit_penalty_percent  numeric(10,4)
  max_consecutive_missed_months  integer
  redemption_mode  character varying(50)
  gold_coin_purity  character varying(20)
  silver_coin_grams  numeric(14,3)
  gifts_value  numeric(14,2)
  gifts  ARRAY NOT NULL DEFAULT '{}'::text[]
  sort_order  integer NOT NULL DEFAULT 0
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### silver_rates  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  rate_date  date NOT NULL
  purity  character varying(10) NOT NULL
  rate_per_gram  numeric(14,4) NOT NULL
  rate_per_kg  numeric(14,2) NOT NULL
  updated_by  character varying(200)
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### stall_config  (rows: 1)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  key  character varying(50) NOT NULL DEFAULT 'global'::character varying
  is_enabled  boolean NOT NULL DEFAULT false
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### store_config  (rows: 1)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  key  character varying(50) NOT NULL DEFAULT 'global'::character varying
  theme  character varying(100) NOT NULL DEFAULT 'icy-silver'::character varying
  is_dark  boolean NOT NULL DEFAULT false
  marquee_messages  ARRAY NOT NULL DEFAULT '{}'::text[]
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### unmatched_return_videos  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  sender_phone  character varying(50) NOT NULL
  file_path  text NOT NULL
  mime_type  character varying(200) NOT NULL
  caption  text
  linked_return_id  bigint
  received_at  timestamp with time zone NOT NULL DEFAULT now()
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### user_addresses  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  user_id  bigint NOT NULL
  label  character varying(100)
  first_name  character varying(100) NOT NULL
  last_name  character varying(100)
  address  text NOT NULL
  city  character varying(150) NOT NULL
  state  character varying(150) NOT NULL
  pincode  character varying(20) NOT NULL
  phone  character varying(50) NOT NULL
  is_default  boolean NOT NULL DEFAULT false
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### users  (rows: 3)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  name  character varying(200) NOT NULL
  email  character varying(320) NOT NULL
  password_hash  text NOT NULL
  phone  character varying(50)
  is_admin  boolean NOT NULL DEFAULT false
  is_active  boolean NOT NULL DEFAULT true
  role  character varying(20)
  is_stall_registration  boolean NOT NULL DEFAULT false
  date_of_birth  date
  anniversary_date  date
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()

### wishlist_items  (rows: 0)
  id  bigint NOT NULL
  wishlist_id  bigint NOT NULL
  product_id  bigint NOT NULL
  created_at  timestamp with time zone NOT NULL DEFAULT now()

### wishlists  (rows: 0)
  id  bigint NOT NULL
  legacy_mongo_id  character varying(24)
  user_id  bigint NOT NULL
  created_at  timestamp with time zone NOT NULL DEFAULT now()
  updated_at  timestamp with time zone NOT NULL DEFAULT now()


## CONSTRAINTS
cart_items: FOREIGN KEY (cart_id) -> carts.id  [cart_items_cart_id_fkey]
cart_items: FOREIGN KEY (product_id) -> products.id  [cart_items_product_id_fkey]
cart_items: PRIMARY KEY (id)  [cart_items_pkey]
cart_items: UNIQUE (legacy_mongo_id)  [uq_cart_items_legacy_mongo_id]
carts: FOREIGN KEY (user_id) -> users.id  [carts_user_id_fkey]
carts: PRIMARY KEY (id)  [carts_pkey]
carts: UNIQUE (legacy_mongo_id)  [uq_carts_legacy_mongo_id]
carts: UNIQUE (user_id)  [uq_carts_user_id]
categories: PRIMARY KEY (id)  [categories_pkey]
categories: UNIQUE (legacy_mongo_id)  [uq_categories_legacy_mongo_id]
coupons: PRIMARY KEY (id)  [coupons_pkey]
coupons: UNIQUE (code)  [uq_coupons_code]
coupons: UNIQUE (legacy_mongo_id)  [uq_coupons_legacy_mongo_id]
delivery_config: PRIMARY KEY (id)  [delivery_config_pkey]
delivery_config: UNIQUE (key)  [uq_delivery_config_key]
delivery_config: UNIQUE (legacy_mongo_id)  [uq_delivery_config_legacy_mongo_id]
filter_config: PRIMARY KEY (id)  [filter_config_pkey]
filter_config: UNIQUE (key)  [uq_filter_config_key]
filter_config: UNIQUE (legacy_mongo_id)  [uq_filter_config_legacy_mongo_id]
filter_price_ranges: FOREIGN KEY (filter_config_id) -> filter_config.id  [filter_price_ranges_filter_config_id_fkey]
filter_price_ranges: PRIMARY KEY (id)  [filter_price_ranges_pkey]
gift_vouchers: PRIMARY KEY (id)  [gift_vouchers_pkey]
gift_vouchers: UNIQUE (legacy_mongo_id)  [uq_gift_vouchers_legacy_mongo_id]
inventory: FOREIGN KEY (product_id) -> products.id  [inventory_product_id_fkey]
inventory: PRIMARY KEY (id)  [inventory_pkey]
inventory: UNIQUE (legacy_mongo_id)  [uq_inventory_legacy_mongo_id]
inventory: UNIQUE (product_id)  [uq_inventory_product_id]
inventory_transactions: FOREIGN KEY (performed_by) -> users.id  [inventory_transactions_performed_by_fkey]
inventory_transactions: FOREIGN KEY (product_id) -> products.id  [inventory_transactions_product_id_fkey]
inventory_transactions: PRIMARY KEY (id)  [inventory_transactions_pkey]
inventory_transactions: UNIQUE (legacy_mongo_id)  [uq_inventory_transactions_legacy_mongo_id]
invoice_config: PRIMARY KEY (id)  [invoice_config_pkey]
invoice_config: UNIQUE (key)  [uq_invoice_config_key]
invoice_config: UNIQUE (legacy_mongo_id)  [uq_invoice_config_legacy_mongo_id]
metal_rates: PRIMARY KEY (id)  [metal_rates_pkey]
metal_rates: UNIQUE (legacy_mongo_id)  [uq_metal_rates_legacy_mongo_id]
order_items: FOREIGN KEY (order_id) -> orders.id  [order_items_order_id_fkey]
order_items: FOREIGN KEY (product_id) -> products.id  [order_items_product_id_fkey]
order_items: PRIMARY KEY (id)  [order_items_pkey]
order_items: UNIQUE (legacy_mongo_id)  [uq_order_items_legacy_mongo_id]
orders: FOREIGN KEY (user_id) -> users.id  [orders_user_id_fkey]
orders: PRIMARY KEY (id)  [orders_pkey]
orders: UNIQUE (invoice_number)  [uq_orders_invoice_number]
orders: UNIQUE (legacy_mongo_id)  [uq_orders_legacy_mongo_id]
otp_codes: PRIMARY KEY (id)  [otp_codes_pkey]
otp_codes: UNIQUE (legacy_mongo_id)  [uq_otp_codes_legacy_mongo_id]
pincode_rates: PRIMARY KEY (id)  [pincode_rates_pkey]
pincode_rates: UNIQUE (legacy_mongo_id)  [uq_pincode_rates_legacy_mongo_id]
pincode_rates: UNIQUE (pincode)  [uq_pincode_rates_pincode]
pricing_config: PRIMARY KEY (id)  [pricing_config_pkey]
pricing_config: UNIQUE (key)  [uq_pricing_config_key]
pricing_config: UNIQUE (legacy_mongo_id)  [uq_pricing_config_legacy_mongo_id]
product_images: FOREIGN KEY (product_id) -> products.id  [product_images_product_id_fkey]
product_images: PRIMARY KEY (id)  [product_images_pkey]
product_images: UNIQUE (legacy_mongo_id)  [uq_product_images_legacy_mongo_id]
product_variants: FOREIGN KEY (product_id) -> products.id  [product_variants_product_id_fkey]
product_variants: PRIMARY KEY (id)  [product_variants_pkey]
product_variants: UNIQUE (legacy_mongo_id)  [uq_product_variants_legacy_mongo_id]
products: PRIMARY KEY (id)  [products_pkey]
products: UNIQUE (legacy_mongo_id)  [uq_products_legacy_mongo_id]
products: UNIQUE (product_group_code)  [uq_products_product_group_code]
rate_status: PRIMARY KEY (id)  [rate_status_pkey]
rate_status: UNIQUE (key)  [uq_rate_status_key]
rate_status: UNIQUE (legacy_mongo_id)  [uq_rate_status_legacy_mongo_id]
return_items: FOREIGN KEY (order_item_id) -> order_items.id  [return_items_order_item_id_fkey]
return_items: FOREIGN KEY (return_id) -> returns.id  [return_items_return_id_fkey]
return_items: PRIMARY KEY (id)  [return_items_pkey]
return_items: UNIQUE (legacy_mongo_id)  [uq_return_items_legacy_mongo_id]
returns: FOREIGN KEY (order_id) -> orders.id  [returns_order_id_fkey]
returns: FOREIGN KEY (user_id) -> users.id  [returns_user_id_fkey]
returns: PRIMARY KEY (id)  [returns_pkey]
returns: UNIQUE (legacy_mongo_id)  [uq_returns_legacy_mongo_id]
returns: UNIQUE (video_reference_code)  [uq_returns_video_reference_code]
reviews: FOREIGN KEY (product_id) -> products.id  [reviews_product_id_fkey]
reviews: FOREIGN KEY (user_id) -> users.id  [reviews_user_id_fkey]
reviews: PRIMARY KEY (id)  [reviews_pkey]
reviews: UNIQUE (legacy_mongo_id)  [uq_reviews_legacy_mongo_id]
reviews: UNIQUE (product_id,user_id)  [uq_reviews_product_user]
savings_accounts: FOREIGN KEY (plan_id) -> scheme_plans.id  [savings_accounts_plan_id_fkey]
savings_accounts: FOREIGN KEY (user_id) -> users.id  [savings_accounts_user_id_fkey]
savings_accounts: PRIMARY KEY (id)  [savings_accounts_pkey]
savings_accounts: UNIQUE (legacy_mongo_id)  [uq_savings_accounts_legacy_mongo_id]
savings_accounts: UNIQUE (passbook_number)  [uq_savings_accounts_passbook_number]
savings_cancellations: FOREIGN KEY (cancelled_by) -> users.id  [savings_cancellations_cancelled_by_fkey]
savings_cancellations: FOREIGN KEY (savings_account_id) -> savings_accounts.id  [savings_cancellations_savings_account_id_fkey]
savings_cancellations: PRIMARY KEY (id)  [savings_cancellations_pkey]
savings_cancellations: UNIQUE (savings_account_id)  [savings_cancellations_savings_account_id_key]
savings_maturity_benefits: FOREIGN KEY (savings_account_id) -> savings_accounts.id  [savings_maturity_benefits_savings_account_id_fkey]
savings_maturity_benefits: PRIMARY KEY (id)  [savings_maturity_benefits_pkey]
savings_maturity_benefits: UNIQUE (savings_account_id)  [savings_maturity_benefits_savings_account_id_key]
savings_payments: FOREIGN KEY (recorded_by) -> users.id  [savings_payments_recorded_by_fkey]
savings_payments: FOREIGN KEY (savings_account_id) -> savings_accounts.id  [savings_payments_savings_account_id_fkey]
savings_payments: PRIMARY KEY (id)  [savings_payments_pkey]
savings_payments: UNIQUE (legacy_mongo_id)  [uq_savings_payments_legacy_mongo_id]
scheme_plan_monthly_amounts: FOREIGN KEY (scheme_plan_id) -> scheme_plans.id  [scheme_plan_monthly_amounts_scheme_plan_id_fkey]
scheme_plan_monthly_amounts: PRIMARY KEY (id)  [scheme_plan_monthly_amounts_pkey]
scheme_plan_monthly_amounts: UNIQUE (scheme_plan_id,amount)  [uq_scheme_plan_amount]
scheme_plans: PRIMARY KEY (id)  [scheme_plans_pkey]
scheme_plans: UNIQUE (legacy_mongo_id)  [uq_scheme_plans_legacy_mongo_id]
scheme_plans: UNIQUE (type)  [uq_scheme_plans_type]
silver_rates: PRIMARY KEY (id)  [silver_rates_pkey]
silver_rates: UNIQUE (rate_date,purity)  [uq_silver_rates_date_purity]
silver_rates: UNIQUE (legacy_mongo_id)  [uq_silver_rates_legacy_mongo_id]
stall_config: PRIMARY KEY (id)  [stall_config_pkey]
stall_config: UNIQUE (key)  [uq_stall_config_key]
stall_config: UNIQUE (legacy_mongo_id)  [uq_stall_config_legacy_mongo_id]
store_config: PRIMARY KEY (id)  [store_config_pkey]
store_config: UNIQUE (key)  [uq_store_config_key]
store_config: UNIQUE (legacy_mongo_id)  [uq_store_config_legacy_mongo_id]
unmatched_return_videos: FOREIGN KEY (linked_return_id) -> returns.id  [unmatched_return_videos_linked_return_id_fkey]
unmatched_return_videos: PRIMARY KEY (id)  [unmatched_return_videos_pkey]
unmatched_return_videos: UNIQUE (legacy_mongo_id)  [uq_unmatched_return_videos_legacy_mongo_id]
user_addresses: FOREIGN KEY (user_id) -> users.id  [user_addresses_user_id_fkey]
user_addresses: PRIMARY KEY (id)  [user_addresses_pkey]
user_addresses: UNIQUE (legacy_mongo_id)  [uq_user_addresses_legacy_mongo_id]
users: PRIMARY KEY (id)  [users_pkey]
users: UNIQUE (email)  [uq_users_email]
users: UNIQUE (legacy_mongo_id)  [uq_users_legacy_mongo_id]
wishlist_items: FOREIGN KEY (product_id) -> products.id  [wishlist_items_product_id_fkey]
wishlist_items: FOREIGN KEY (wishlist_id) -> wishlists.id  [wishlist_items_wishlist_id_fkey]
wishlist_items: PRIMARY KEY (id)  [wishlist_items_pkey]
wishlist_items: UNIQUE (wishlist_id,product_id)  [uq_wishlist_items]
wishlists: FOREIGN KEY (user_id) -> users.id  [wishlists_user_id_fkey]
wishlists: PRIMARY KEY (id)  [wishlists_pkey]
wishlists: UNIQUE (legacy_mongo_id)  [uq_wishlists_legacy_mongo_id]
wishlists: UNIQUE (user_id)  [uq_wishlists_user_id]


## INDEXES
CREATE INDEX ix_cart_items_cart_id ON public.cart_items USING btree (cart_id)
CREATE INDEX ix_cart_items_product_id ON public.cart_items USING btree (product_id)
CREATE UNIQUE INDEX cart_items_pkey ON public.cart_items USING btree (id)
CREATE UNIQUE INDEX uq_cart_items_legacy_mongo_id ON public.cart_items USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_carts_legacy_mongo_id ON public.carts USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX carts_pkey ON public.carts USING btree (id)
CREATE UNIQUE INDEX uq_carts_user_id ON public.carts USING btree (user_id)
CREATE UNIQUE INDEX uq_categories_legacy_mongo_id ON public.categories USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_categories_name_parent ON public.categories USING btree (name, COALESCE(parent, ''::character varying))
CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id)
CREATE UNIQUE INDEX coupons_pkey ON public.coupons USING btree (id)
CREATE UNIQUE INDEX uq_coupons_legacy_mongo_id ON public.coupons USING btree (legacy_mongo_id)
CREATE INDEX ix_coupons_active_expiry ON public.coupons USING btree (is_active, expiry_date)
CREATE UNIQUE INDEX uq_coupons_code ON public.coupons USING btree (code)
CREATE UNIQUE INDEX uq_delivery_config_key ON public.delivery_config USING btree (key)
CREATE UNIQUE INDEX delivery_config_pkey ON public.delivery_config USING btree (id)
CREATE UNIQUE INDEX uq_delivery_config_legacy_mongo_id ON public.delivery_config USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_filter_config_key ON public.filter_config USING btree (key)
CREATE UNIQUE INDEX filter_config_pkey ON public.filter_config USING btree (id)
CREATE UNIQUE INDEX uq_filter_config_legacy_mongo_id ON public.filter_config USING btree (legacy_mongo_id)
CREATE INDEX ix_filter_price_ranges_config ON public.filter_price_ranges USING btree (filter_config_id, sort_order)
CREATE UNIQUE INDEX filter_price_ranges_pkey ON public.filter_price_ranges USING btree (id)
CREATE INDEX ix_gift_vouchers_active_sort ON public.gift_vouchers USING btree (is_active, sort_order)
CREATE UNIQUE INDEX gift_vouchers_pkey ON public.gift_vouchers USING btree (id)
CREATE UNIQUE INDEX uq_gift_vouchers_legacy_mongo_id ON public.gift_vouchers USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_inventory_legacy_mongo_id ON public.inventory USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX inventory_pkey ON public.inventory USING btree (id)
CREATE INDEX ix_inventory_low_stock ON public.inventory USING btree (current_stock, stock_threshold)
CREATE UNIQUE INDEX uq_inventory_product_id ON public.inventory USING btree (product_id)
CREATE INDEX ix_inventory_transactions_type ON public.inventory_transactions USING btree (type)
CREATE INDEX ix_inventory_transactions_product ON public.inventory_transactions USING btree (product_id)
CREATE UNIQUE INDEX uq_inventory_transactions_legacy_mongo_id ON public.inventory_transactions USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX inventory_transactions_pkey ON public.inventory_transactions USING btree (id)
CREATE INDEX ix_inventory_transactions_date ON public.inventory_transactions USING btree (date DESC)
CREATE UNIQUE INDEX uq_invoice_config_legacy_mongo_id ON public.invoice_config USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_invoice_config_key ON public.invoice_config USING btree (key)
CREATE UNIQUE INDEX invoice_config_pkey ON public.invoice_config USING btree (id)
CREATE UNIQUE INDEX metal_rates_pkey ON public.metal_rates USING btree (id)
CREATE UNIQUE INDEX uq_metal_rates_legacy_mongo_id ON public.metal_rates USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_metal_rates_date_metal_karat ON public.metal_rates USING btree (rate_date, metal, COALESCE(karat, '-1'::integer))
CREATE INDEX ix_metal_rates_lookup ON public.metal_rates USING btree (rate_date DESC, metal, karat)
CREATE INDEX ix_order_items_product_id ON public.order_items USING btree (product_id)
CREATE INDEX ix_order_items_order_id ON public.order_items USING btree (order_id)
CREATE UNIQUE INDEX uq_order_items_legacy_mongo_id ON public.order_items USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id)
CREATE INDEX ix_orders_razorpay_order_id ON public.orders USING btree (razorpay_order_id)
CREATE INDEX ix_orders_user_id ON public.orders USING btree (user_id)
CREATE INDEX ix_orders_status ON public.orders USING btree (status)
CREATE INDEX ix_orders_payment_status ON public.orders USING btree (payment_status)
CREATE INDEX ix_orders_created_at ON public.orders USING btree (created_at DESC)
CREATE UNIQUE INDEX uq_orders_invoice_number ON public.orders USING btree (invoice_number)
CREATE INDEX ix_orders_razorpay_payment_id ON public.orders USING btree (razorpay_payment_id)
CREATE INDEX ix_orders_user_created ON public.orders USING btree (user_id, created_at DESC)
CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)
CREATE UNIQUE INDEX uq_orders_legacy_mongo_id ON public.orders USING btree (legacy_mongo_id)
CREATE INDEX ix_otp_codes_expires_at ON public.otp_codes USING btree (expires_at)
CREATE UNIQUE INDEX uq_otp_codes_legacy_mongo_id ON public.otp_codes USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX otp_codes_pkey ON public.otp_codes USING btree (id)
CREATE INDEX ix_otp_codes_identifier ON public.otp_codes USING btree (identifier)
CREATE UNIQUE INDEX pincode_rates_pkey ON public.pincode_rates USING btree (id)
CREATE UNIQUE INDEX uq_pincode_rates_pincode ON public.pincode_rates USING btree (pincode)
CREATE UNIQUE INDEX uq_pincode_rates_legacy_mongo_id ON public.pincode_rates USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX pricing_config_pkey ON public.pricing_config USING btree (id)
CREATE UNIQUE INDEX uq_pricing_config_key ON public.pricing_config USING btree (key)
CREATE UNIQUE INDEX uq_pricing_config_legacy_mongo_id ON public.pricing_config USING btree (legacy_mongo_id)
CREATE INDEX ix_product_images_product_sort ON public.product_images USING btree (product_id, sort_order)
CREATE UNIQUE INDEX product_images_pkey ON public.product_images USING btree (id)
CREATE UNIQUE INDEX uq_product_images_legacy_mongo_id ON public.product_images USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX product_variants_pkey ON public.product_variants USING btree (id)
CREATE UNIQUE INDEX uq_product_variants_legacy_mongo_id ON public.product_variants USING btree (legacy_mongo_id)
CREATE INDEX ix_product_variants_product_id ON public.product_variants USING btree (product_id)
CREATE INDEX ix_products_is_featured ON public.products USING btree (is_featured) WHERE (is_featured = true)
CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)
CREATE UNIQUE INDEX uq_products_legacy_mongo_id ON public.products USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_products_product_group_code ON public.products USING btree (product_group_code)
CREATE INDEX ix_products_category ON public.products USING btree (category)
CREATE INDEX ix_products_subcategory ON public.products USING btree (subcategory)
CREATE INDEX ix_products_is_active ON public.products USING btree (is_active)
CREATE INDEX ix_products_created_at ON public.products USING btree (created_at DESC)
CREATE INDEX ix_products_tags ON public.products USING gin (tags)
CREATE UNIQUE INDEX rate_status_pkey ON public.rate_status USING btree (id)
CREATE UNIQUE INDEX uq_rate_status_key ON public.rate_status USING btree (key)
CREATE UNIQUE INDEX uq_rate_status_legacy_mongo_id ON public.rate_status USING btree (legacy_mongo_id)
CREATE INDEX ix_return_items_return_id ON public.return_items USING btree (return_id)
CREATE INDEX ix_return_items_order_item_id ON public.return_items USING btree (order_item_id)
CREATE UNIQUE INDEX return_items_pkey ON public.return_items USING btree (id)
CREATE UNIQUE INDEX uq_return_items_legacy_mongo_id ON public.return_items USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_returns_video_reference_code ON public.returns USING btree (video_reference_code)
CREATE INDEX ix_returns_user_id ON public.returns USING btree (user_id)
CREATE INDEX ix_returns_order_id ON public.returns USING btree (order_id)
CREATE UNIQUE INDEX returns_pkey ON public.returns USING btree (id)
CREATE UNIQUE INDEX uq_returns_legacy_mongo_id ON public.returns USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_reviews_product_user ON public.reviews USING btree (product_id, user_id)
CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id)
CREATE UNIQUE INDEX uq_reviews_legacy_mongo_id ON public.reviews USING btree (legacy_mongo_id)
CREATE INDEX ix_reviews_product_id ON public.reviews USING btree (product_id)
CREATE UNIQUE INDEX uq_savings_accounts_passbook_number ON public.savings_accounts USING btree (passbook_number)
CREATE INDEX ix_savings_accounts_scheme_type ON public.savings_accounts USING btree (scheme_type)
CREATE INDEX ix_savings_accounts_user_id ON public.savings_accounts USING btree (user_id)
CREATE INDEX ix_savings_accounts_user_created ON public.savings_accounts USING btree (user_id, created_at DESC)
CREATE UNIQUE INDEX savings_accounts_pkey ON public.savings_accounts USING btree (id)
CREATE UNIQUE INDEX uq_savings_accounts_legacy_mongo_id ON public.savings_accounts USING btree (legacy_mongo_id)
CREATE INDEX ix_savings_accounts_status ON public.savings_accounts USING btree (status)
CREATE INDEX ix_savings_cancellations_cancelled_by ON public.savings_cancellations USING btree (cancelled_by)
CREATE UNIQUE INDEX savings_cancellations_savings_account_id_key ON public.savings_cancellations USING btree (savings_account_id)
CREATE UNIQUE INDEX savings_cancellations_pkey ON public.savings_cancellations USING btree (id)
CREATE UNIQUE INDEX savings_maturity_benefits_savings_account_id_key ON public.savings_maturity_benefits USING btree (savings_account_id)
CREATE UNIQUE INDEX savings_maturity_benefits_pkey ON public.savings_maturity_benefits USING btree (id)
CREATE UNIQUE INDEX savings_payments_pkey ON public.savings_payments USING btree (id)
CREATE UNIQUE INDEX uq_savings_payments_legacy_mongo_id ON public.savings_payments USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_savings_real_installment_month ON public.savings_payments USING btree (savings_account_id, due_month_key) WHERE ((due_month_key IS NOT NULL) AND (amount > (0)::numeric))
CREATE INDEX ix_savings_payments_account ON public.savings_payments USING btree (savings_account_id)
CREATE INDEX ix_savings_payments_paid_at ON public.savings_payments USING btree (paid_at DESC)
CREATE INDEX ix_scheme_plan_amounts_plan ON public.scheme_plan_monthly_amounts USING btree (scheme_plan_id)
CREATE UNIQUE INDEX uq_scheme_plan_amount ON public.scheme_plan_monthly_amounts USING btree (scheme_plan_id, amount)
CREATE UNIQUE INDEX scheme_plan_monthly_amounts_pkey ON public.scheme_plan_monthly_amounts USING btree (id)
CREATE UNIQUE INDEX uq_scheme_plans_legacy_mongo_id ON public.scheme_plans USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_scheme_plans_type ON public.scheme_plans USING btree (type)
CREATE UNIQUE INDEX scheme_plans_pkey ON public.scheme_plans USING btree (id)
CREATE INDEX ix_silver_rates_date ON public.silver_rates USING btree (rate_date DESC)
CREATE UNIQUE INDEX uq_silver_rates_date_purity ON public.silver_rates USING btree (rate_date, purity)
CREATE UNIQUE INDEX uq_silver_rates_legacy_mongo_id ON public.silver_rates USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX silver_rates_pkey ON public.silver_rates USING btree (id)
CREATE UNIQUE INDEX uq_stall_config_key ON public.stall_config USING btree (key)
CREATE UNIQUE INDEX stall_config_pkey ON public.stall_config USING btree (id)
CREATE UNIQUE INDEX uq_stall_config_legacy_mongo_id ON public.stall_config USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX store_config_pkey ON public.store_config USING btree (id)
CREATE UNIQUE INDEX uq_store_config_key ON public.store_config USING btree (key)
CREATE UNIQUE INDEX uq_store_config_legacy_mongo_id ON public.store_config USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX uq_unmatched_return_videos_legacy_mongo_id ON public.unmatched_return_videos USING btree (legacy_mongo_id)
CREATE INDEX ix_unmatched_return_videos_linked_return ON public.unmatched_return_videos USING btree (linked_return_id)
CREATE INDEX ix_unmatched_return_videos_sender_phone ON public.unmatched_return_videos USING btree (sender_phone)
CREATE UNIQUE INDEX unmatched_return_videos_pkey ON public.unmatched_return_videos USING btree (id)
CREATE UNIQUE INDEX user_addresses_pkey ON public.user_addresses USING btree (id)
CREATE INDEX ix_user_addresses_user_id ON public.user_addresses USING btree (user_id)
CREATE UNIQUE INDEX uq_user_addresses_legacy_mongo_id ON public.user_addresses USING btree (legacy_mongo_id)
CREATE INDEX ix_user_addresses_default ON public.user_addresses USING btree (user_id, is_default)
CREATE UNIQUE INDEX uq_users_email ON public.users USING btree (email)
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)
CREATE UNIQUE INDEX uq_users_legacy_mongo_id ON public.users USING btree (legacy_mongo_id)
CREATE INDEX ix_users_is_active ON public.users USING btree (is_active)
CREATE INDEX ix_users_phone ON public.users USING btree (phone)
CREATE INDEX ix_users_role ON public.users USING btree (role)
CREATE UNIQUE INDEX uq_wishlist_items ON public.wishlist_items USING btree (wishlist_id, product_id)
CREATE UNIQUE INDEX wishlist_items_pkey ON public.wishlist_items USING btree (id)
CREATE UNIQUE INDEX uq_wishlists_legacy_mongo_id ON public.wishlists USING btree (legacy_mongo_id)
CREATE UNIQUE INDEX wishlists_pkey ON public.wishlists USING btree (id)
CREATE UNIQUE INDEX uq_wishlists_user_id ON public.wishlists USING btree (user_id)


## ENUMS
