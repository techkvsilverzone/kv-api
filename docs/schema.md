 docker exec -i kvs-postgres psql \
  -U kvs_admin \
  -d kvs_ecommerce \
  -c "\dt"
                    List of relations
 Schema |            Name             | Type  |   Owner
--------+-----------------------------+-------+-----------
 public | cart_items                  | table | kvs_admin
 public | carts                       | table | kvs_admin
 public | categories                  | table | kvs_admin
 public | coupons                     | table | kvs_admin
 public | delivery_config             | table | kvs_admin
 public | filter_config               | table | kvs_admin
 public | filter_price_ranges         | table | kvs_admin
 public | gift_vouchers               | table | kvs_admin
 public | inventory                   | table | kvs_admin
 public | inventory_transactions      | table | kvs_admin
 public | invoice_config              | table | kvs_admin
 public | metal_rates                 | table | kvs_admin
 public | order_items                 | table | kvs_admin
 public | orders                      | table | kvs_admin
 public | otp_codes                   | table | kvs_admin
 public | pincode_rates               | table | kvs_admin
 public | pricing_config              | table | kvs_admin
 public | product_images              | table | kvs_admin
 public | product_variants            | table | kvs_admin
 public | products                    | table | kvs_admin
 public | rate_status                 | table | kvs_admin
 public | return_items                | table | kvs_admin
 public | returns                     | table | kvs_admin
 public | reviews                     | table | kvs_admin
 public | savings_accounts            | table | kvs_admin
 public | savings_cancellations       | table | kvs_admin
 public | savings_maturity_benefits   | table | kvs_admin
 public | savings_payments            | table | kvs_admin
 public | scheme_plan_monthly_amounts | table | kvs_admin
 public | scheme_plans                | table | kvs_admin
 public | silver_rates                | table | kvs_admin
 public | stall_config                | table | kvs_admin
 public | store_config                | table | kvs_admin
 public | unmatched_return_videos     | table | kvs_admin
 public | user_addresses              | table | kvs_admin
 public | users                       | table | kvs_admin
 public | wishlist_items              | table | kvs_admin
 public | wishlists                   | table | kvs_admin
(38 rows)

 docker exec -i kvs-postgres psql \
  -U kvs_admin \
  -d kvs_ecommerce \
  -c "
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
"
         table_name          |          column_name          |        data_type
-----------------------------+-------------------------------+--------------------------
 cart_items                  | id                            | bigint
 cart_items                  | legacy_mongo_id               | character varying
 cart_items                  | cart_id                       | bigint
 cart_items                  | product_id                    | bigint
 cart_items                  | product_group_code            | character varying
 cart_items                  | product_name                  | character varying
 cart_items                  | quantity                      | integer
 cart_items                  | weight                        | numeric
 cart_items                  | unit_price                    | numeric
 cart_items                  | created_at                    | timestamp with time zone
 cart_items                  | updated_at                    | timestamp with time zone
 carts                       | id                            | bigint
 carts                       | legacy_mongo_id               | character varying
 carts                       | user_id                       | bigint
 carts                       | created_at                    | timestamp with time zone
 carts                       | updated_at                    | timestamp with time zone
 categories                  | id                            | bigint
 categories                  | legacy_mongo_id               | character varying
 categories                  | name                          | character varying
 categories                  | parent                        | character varying
 categories                  | created_at                    | timestamp with time zone
 categories                  | updated_at                    | timestamp with time zone
 coupons                     | id                            | bigint
 coupons                     | legacy_mongo_id               | character varying
 coupons                     | code                          | character varying
 coupons                     | discount_type                 | character varying
 coupons                     | discount_value                | numeric
 coupons                     | min_order_amount              | numeric
 coupons                     | max_uses                      | integer
 coupons                     | used_count                    | integer
 coupons                     | expiry_date                   | timestamp with time zone
 coupons                     | is_active                     | boolean
 coupons                     | created_at                    | timestamp with time zone
 coupons                     | updated_at                    | timestamp with time zone
 delivery_config             | id                            | bigint
 delivery_config             | legacy_mongo_id               | character varying
 delivery_config             | key                           | character varying
 delivery_config             | chennai                       | numeric
 delivery_config             | other_district                | numeric
 delivery_config             | other_state                   | numeric
 delivery_config             | created_at                    | timestamp with time zone
 delivery_config             | updated_at                    | timestamp with time zone
 filter_config               | id                            | bigint
 filter_config               | legacy_mongo_id               | character varying
 filter_config               | key                           | character varying
 filter_config               | hidden_categories             | ARRAY
 filter_config               | metals                        | ARRAY
 filter_config               | created_at                    | timestamp with time zone
 filter_config               | updated_at                    | timestamp with time zone
 filter_price_ranges         | id                            | bigint
 filter_price_ranges         | filter_config_id              | bigint
 filter_price_ranges         | label                         | character varying
 filter_price_ranges         | value                         | character varying
 filter_price_ranges         | sort_order                    | integer
 gift_vouchers               | id                            | bigint
 gift_vouchers               | legacy_mongo_id               | character varying
 gift_vouchers               | label                         | character varying
 gift_vouchers               | amount                        | numeric
 gift_vouchers               | description                   | text
 gift_vouchers               | image_url                     | text
 gift_vouchers               | is_active                     | boolean
 gift_vouchers               | sort_order                    | integer
 gift_vouchers               | created_at                    | timestamp with time zone
 gift_vouchers               | updated_at                    | timestamp with time zone
 inventory                   | id                            | bigint
 inventory                   | legacy_mongo_id               | character varying
 inventory                   | product_id                    | bigint
 inventory                   | current_stock                 | integer
 inventory                   | stock_threshold               | integer
 inventory                   | created_at                    | timestamp with time zone
 inventory                   | updated_at                    | timestamp with time zone
 inventory_transactions      | id                            | bigint
 inventory_transactions      | legacy_mongo_id               | character varying
 inventory_transactions      | type                          | character varying
 inventory_transactions      | product_id                    | bigint
 inventory_transactions      | quantity                      | integer
 inventory_transactions      | reason                        | text
 inventory_transactions      | performed_by                  | bigint
 inventory_transactions      | date                          | timestamp with time zone
 inventory_transactions      | created_at                    | timestamp with time zone
 inventory_transactions      | updated_at                    | timestamp with time zone
 invoice_config              | id                            | bigint
 invoice_config              | legacy_mongo_id               | character varying
 invoice_config              | key                           | character varying
 invoice_config              | company_name                  | character varying
 invoice_config              | gstin                         | character varying
 invoice_config              | company_address               | text
 invoice_config              | company_phone                 | character varying
 invoice_config              | company_email                 | character varying
 invoice_config              | created_at                    | timestamp with time zone
 invoice_config              | updated_at                    | timestamp with time zone
 metal_rates                 | id                            | bigint
 metal_rates                 | legacy_mongo_id               | character varying
 metal_rates                 | rate_date                     | date
 metal_rates                 | metal                         | character varying
 metal_rates                 | karat                         | integer
 metal_rates                 | rate_per_gram                 | numeric
 metal_rates                 | rate_per_kg                   | numeric
 metal_rates                 | updated_by                    | character varying
 metal_rates                 | created_at                    | timestamp with time zone
 metal_rates                 | updated_at                    | timestamp with time zone
 order_items                 | id                            | bigint
 order_items                 | legacy_mongo_id               | character varying
 order_items                 | order_id                      | bigint
 order_items                 | product_id                    | bigint
 order_items                 | product_group_code            | character varying
 order_items                 | product_name                  | character varying
 order_items                 | quantity                      | integer
 order_items                 | weight                        | numeric
 order_items                 | unit_price                    | numeric
 order_items                 | total_price                   | numeric
 order_items                 | is_gift_voucher               | boolean
 order_items                 | created_at                    | timestamp with time zone
 order_items                 | updated_at                    | timestamp with time zone
 orders                      | id                            | bigint
 orders                      | legacy_mongo_id               | character varying
 orders                      | user_id                       | bigint
 orders                      | invoice_number                | character varying
 orders                      | status                        | character varying
 orders                      | payment_method                | character varying
 orders                      | payment_status                | character varying
 orders                      | razorpay_order_id             | character varying
 orders                      | razorpay_payment_id           | character varying
 orders                      | coupon_code                   | character varying
 orders                      | coupon_discount               | numeric
 orders                      | gift_wrap                     | boolean
 orders                      | gift_message                  | character varying
 orders                      | gift_wrap_fee                 | numeric
 orders                      | subtotal                      | numeric
 orders                      | tax_amount                    | numeric
 orders                      | total_with_tax                | numeric
 orders                      | delivery_fee                  | numeric
 orders                      | grand_total                   | numeric
 orders                      | total_amount                  | numeric
 orders                      | tax                           | numeric
 orders                      | shipping_name                 | character varying
 orders                      | shipping_phone                | character varying
 orders                      | shipping_line1                | text
 orders                      | shipping_line2                | text
 orders                      | shipping_city                 | character varying
 orders                      | shipping_state                | character varying
 orders                      | shipping_pincode              | character varying
 orders                      | shipping_country              | character varying
 orders                      | delivered_at                  | timestamp with time zone
 orders                      | created_at                    | timestamp with time zone
 orders                      | updated_at                    | timestamp with time zone
 otp_codes                   | id                            | bigint
 otp_codes                   | legacy_mongo_id               | character varying
 otp_codes                   | identifier                    | character varying
 otp_codes                   | purpose                       | character varying
 otp_codes                   | code_hash                     | text
 otp_codes                   | attempts                      | integer
 otp_codes                   | consumed                      | boolean
 otp_codes                   | expires_at                    | timestamp with time zone
 otp_codes                   | created_at                    | timestamp with time zone
 pincode_rates               | id                            | bigint
 pincode_rates               | legacy_mongo_id               | character varying
 pincode_rates               | pincode                       | character varying
 pincode_rates               | label                         | character varying
 pincode_rates               | rate                          | numeric
 pincode_rates               | created_at                    | timestamp with time zone
 pincode_rates               | updated_at                    | timestamp with time zone
 pricing_config              | id                            | bigint
 pricing_config              | legacy_mongo_id               | character varying
 pricing_config              | key                           | character varying
 pricing_config              | gst_percent                   | numeric
 pricing_config              | created_at                    | timestamp with time zone
 pricing_config              | updated_at                    | timestamp with time zone
 product_images              | id                            | bigint
 product_images              | legacy_mongo_id               | character varying
 product_images              | product_id                    | bigint
 product_images              | variant_name                  | character varying
 product_images              | image_url                     | text
 product_images              | sort_order                    | integer
 product_images              | created_at                    | timestamp with time zone
 product_images              | updated_at                    | timestamp with time zone
 product_variants            | id                            | bigint
 product_variants            | legacy_mongo_id               | character varying
 product_variants            | product_id                    | bigint
 product_variants            | label                         | character varying
 product_variants            | weight                        | character varying
 product_variants            | height                        | character varying
 product_variants            | breadth                       | character varying
 product_variants            | created_at                    | timestamp with time zone
 product_variants            | updated_at                    | timestamp with time zone
 products                    | id                            | bigint
 products                    | legacy_mongo_id               | character varying
 products                    | product_group_code            | character varying
 products                    | name                          | character varying
 products                    | description                   | text
 products                    | material                      | character varying
 products                    | category                      | character varying
 products                    | subcategory                   | character varying
 products                    | tags                          | ARRAY
 products                    | weight                        | numeric
 products                    | price                         | numeric
 products                    | original_price                | numeric
 products                    | purity                        | character varying
 products                    | is_sale                       | boolean
 products                    | is_featured                   | boolean
 products                    | metal_value                   | numeric
 products                    | making_charges                | numeric
 products                    | making_charge_percent         | numeric
 products                    | making_charge_per_gram        | numeric
 products                    | quantity                      | integer
 products                    | is_active                     | boolean
 products                    | is_fixed_price                | boolean
 products                    | making_charge_type            | character varying
 products                    | making_charge_value           | numeric
 products                    | wastage_type                  | character varying
 products                    | wastage_value                 | numeric
 products                    | created_at                    | timestamp with time zone
 products                    | updated_at                    | timestamp with time zone
 rate_status                 | id                            | bigint
 rate_status                 | legacy_mongo_id               | character varying
 rate_status                 | key                           | character varying
 rate_status                 | blocked                       | boolean
 rate_status                 | stale_metals                  | ARRAY
 rate_status                 | checked_at                    | timestamp with time zone
 rate_status                 | created_at                    | timestamp with time zone
 rate_status                 | updated_at                    | timestamp with time zone
 return_items                | id                            | bigint
 return_items                | legacy_mongo_id               | character varying
 return_items                | return_id                     | bigint
 return_items                | order_item_id                 | bigint
 return_items                | product_name                  | character varying
 return_items                | quantity                      | integer
 return_items                | reason                        | text
 return_items                | created_at                    | timestamp with time zone
 return_items                | updated_at                    | timestamp with time zone
 returns                     | id                            | bigint
 returns                     | legacy_mongo_id               | character varying
 returns                     | order_id                      | bigint
 returns                     | user_id                       | bigint
 returns                     | reason                        | text
 returns                     | description                   | text
 returns                     | status                        | character varying
 returns                     | refund_amount                 | numeric
 returns                     | fault_type                    | character varying
 returns                     | video_status                  | character varying
 returns                     | video_reference_code          | character varying
 returns                     | video_file_path               | text
 returns                     | video_mime_type               | character varying
 returns                     | video_received_at             | timestamp with time zone
 returns                     | video_sender_phone            | character varying
 returns                     | created_at                    | timestamp with time zone
 returns                     | updated_at                    | timestamp with time zone
 reviews                     | id                            | bigint
 reviews                     | legacy_mongo_id               | character varying
 reviews                     | product_id                    | bigint
 reviews                     | user_id                       | bigint
 reviews                     | rating                        | smallint
 reviews                     | comment                       | text
 reviews                     | created_at                    | timestamp with time zone
 reviews                     | updated_at                    | timestamp with time zone
 savings_accounts            | id                            | bigint
 savings_accounts            | legacy_mongo_id               | character varying
 savings_accounts            | user_id                       | bigint
 savings_accounts            | passbook_number               | character varying
 savings_accounts            | scheme_type                   | character varying
 savings_accounts            | plan_id                       | bigint
 savings_accounts            | metal                         | character varying
 savings_accounts            | plan_name                     | character varying
 savings_accounts            | monthly_amount                | numeric
 savings_accounts            | duration                      | integer
 savings_accounts            | bonus_amount                  | numeric
 savings_accounts            | total_paid                    | numeric
 savings_accounts            | status                        | character varying
 savings_accounts            | start_date                    | timestamp with time zone
 savings_accounts            | created_at                    | timestamp with time zone
 savings_accounts            | updated_at                    | timestamp with time zone
 savings_cancellations       | id                            | bigint
 savings_cancellations       | savings_account_id            | bigint
 savings_cancellations       | cancelled_at                  | timestamp with time zone
 savings_cancellations       | amount_paid_at_cancellation   | numeric
 savings_cancellations       | penalty_percent               | numeric
 savings_cancellations       | penalty_amount                | numeric
 savings_cancellations       | gifts_value_deducted          | numeric
 savings_cancellations       | net_redeemable                | numeric
 savings_cancellations       | note                          | text
 savings_cancellations       | cancelled_by                  | bigint
 savings_cancellations       | created_at                    | timestamp with time zone
 savings_cancellations       | updated_at                    | timestamp with time zone
 savings_maturity_benefits   | id                            | bigint
 savings_maturity_benefits   | savings_account_id            | bigint
 savings_maturity_benefits   | gold_coin_value               | numeric
 savings_maturity_benefits   | gold_grams                    | numeric
 savings_maturity_benefits   | gold_rate_per_gram            | numeric
 savings_maturity_benefits   | silver_grams                  | numeric
 savings_maturity_benefits   | silver_value                  | numeric
 savings_maturity_benefits   | silver_rate_per_gram          | numeric
 savings_maturity_benefits   | gifts_value                   | numeric
 savings_maturity_benefits   | gifts                         | ARRAY
 savings_maturity_benefits   | computed_at                   | timestamp with time zone
 savings_maturity_benefits   | created_at                    | timestamp with time zone
 savings_maturity_benefits   | updated_at                    | timestamp with time zone
 savings_payments            | id                            | bigint
 savings_payments            | legacy_mongo_id               | character varying
 savings_payments            | savings_account_id            | bigint
 savings_payments            | month                         | integer
 savings_payments            | amount                        | numeric
 savings_payments            | paid_at                       | timestamp with time zone
 savings_payments            | material_rate                 | numeric
 savings_payments            | material_weight               | numeric
 savings_payments            | devident_amount               | numeric
 savings_payments            | devident_material_rate        | numeric
 savings_payments            | devident_material_weight      | numeric
 savings_payments            | method                        | character varying
 savings_payments            | razorpay_order_id             | character varying
 savings_payments            | razorpay_payment_id           | character varying
 savings_payments            | recorded_by                   | bigint
 savings_payments            | due_month_key                 | character varying
 savings_payments            | created_at                    | timestamp with time zone
 savings_payments            | updated_at                    | timestamp with time zone
 scheme_plan_monthly_amounts | id                            | bigint
 scheme_plan_monthly_amounts | scheme_plan_id                | bigint
 scheme_plan_monthly_amounts | amount                        | numeric
 scheme_plan_monthly_amounts | sort_order                    | integer
 scheme_plans                | id                            | bigint
 scheme_plans                | legacy_mongo_id               | character varying
 scheme_plans                | type                          | character varying
 scheme_plans                | name                          | character varying
 scheme_plans                | description                   | text
 scheme_plans                | is_active                     | boolean
 scheme_plans                | metal                         | character varying
 scheme_plans                | duration_months               | integer
 scheme_plans                | bonus_months                  | integer
 scheme_plans                | passbook_prefix               | character varying
 scheme_plans                | payment_due_day_of_month      | smallint
 scheme_plans                | early_exit_penalty_percent    | numeric
 scheme_plans                | max_consecutive_missed_months | integer
 scheme_plans                | redemption_mode               | character varying
 scheme_plans                | gold_coin_purity              | character varying
 scheme_plans                | silver_coin_grams             | numeric
 scheme_plans                | gifts_value                   | numeric
 scheme_plans                | gifts                         | ARRAY
 scheme_plans                | sort_order                    | integer
 scheme_plans                | created_at                    | timestamp with time zone
 scheme_plans                | updated_at                    | timestamp with time zone
 silver_rates                | id                            | bigint
 silver_rates                | legacy_mongo_id               | character varying
 silver_rates                | rate_date                     | date
 silver_rates                | purity                        | character varying
 silver_rates                | rate_per_gram                 | numeric
 silver_rates                | rate_per_kg                   | numeric
 silver_rates                | updated_by                    | character varying
 silver_rates                | created_at                    | timestamp with time zone
 silver_rates                | updated_at                    | timestamp with time zone
 stall_config                | id                            | bigint
 stall_config                | legacy_mongo_id               | character varying
 stall_config                | key                           | character varying
 stall_config                | is_enabled                    | boolean
 stall_config                | created_at                    | timestamp with time zone
 stall_config                | updated_at                    | timestamp with time zone
 store_config                | id                            | bigint
 store_config                | legacy_mongo_id               | character varying
 store_config                | key                           | character varying
 store_config                | theme                         | character varying
 store_config                | is_dark                       | boolean
 store_config                | marquee_messages              | ARRAY
 store_config                | created_at                    | timestamp with time zone
 store_config                | updated_at                    | timestamp with time zone
 unmatched_return_videos     | id                            | bigint
 unmatched_return_videos     | legacy_mongo_id               | character varying
 unmatched_return_videos     | sender_phone                  | character varying
 unmatched_return_videos     | file_path                     | text
 unmatched_return_videos     | mime_type                     | character varying
 unmatched_return_videos     | caption                       | text
 unmatched_return_videos     | linked_return_id              | bigint
 unmatched_return_videos     | received_at                   | timestamp with time zone
 unmatched_return_videos     | created_at                    | timestamp with time zone
 unmatched_return_videos     | updated_at                    | timestamp with time zone
 user_addresses              | id                            | bigint
 user_addresses              | legacy_mongo_id               | character varying
 user_addresses              | user_id                       | bigint
 user_addresses              | label                         | character varying
 user_addresses              | first_name                    | character varying
 user_addresses              | last_name                     | character varying
 user_addresses              | address                       | text
 user_addresses              | city                          | character varying
 user_addresses              | state                         | character varying
 user_addresses              | pincode                       | character varying
 user_addresses              | phone                         | character varying
 user_addresses              | is_default                    | boolean
 user_addresses              | created_at                    | timestamp with time zone
 user_addresses              | updated_at                    | timestamp with time zone
 users                       | id                            | bigint
 users                       | legacy_mongo_id               | character varying
 users                       | name                          | character varying
 users                       | email                         | character varying
 users                       | password_hash                 | text
 users                       | phone                         | character varying
 users                       | is_admin                      | boolean
 users                       | is_active                     | boolean
 users                       | role                          | character varying
 users                       | is_stall_registration         | boolean
 users                       | date_of_birth                 | date
 users                       | anniversary_date              | date
 users                       | created_at                    | timestamp with time zone
 users                       | updated_at                    | timestamp with time zone
 wishlist_items              | id                            | bigint
 wishlist_items              | wishlist_id                   | bigint
 wishlist_items              | product_id                    | bigint
 wishlist_items              | created_at                    | timestamp with time zone
 wishlists                   | id                            | bigint
 wishlists                   | legacy_mongo_id               | character varying
 wishlists                   | user_id                       | bigint
 wishlists                   | created_at                    | timestamp with time zone
 wishlists                   | updated_at                    | timestamp with time zone
(409 rows)