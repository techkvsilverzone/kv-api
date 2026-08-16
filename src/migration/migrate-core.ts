import mongoose from 'mongoose';
import { Pool, PoolClient } from 'pg';
import { connectMongo, disconnectMongo } from './mongoConnection';
import { config } from '../config';
import { User } from './models/user.model';
import { Category } from './models/category.model';
import { Product } from './models/product.model';
import { Cart } from './models/cart.model';
import { MetalRate } from './models/metalrate.model';
import { RateStatus } from './models/rateStatus.model';
import { StoreConfig } from './models/storeConfig.model';

const pgUrl = process.env.POSTGRES_MIGRATION_URL;

if (!config.mongoUri) throw new Error('MONGO_URI is not set — refusing to migrate.');
if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(config.mongoUri))
  throw new Error('Refusing to migrate from localhost MongoDB.');
if (!pgUrl) throw new Error('POSTGRES_MIGRATION_URL is not set.');

const date = (v: unknown) => v ? new Date(v as string | Date) : null;

const documentDate = (doc: unknown, field: 'createdAt' | 'updatedAt') => {
  const value = (doc as Record<string, unknown>)[field];
  return value ? new Date(value as string | Date) : null;
};

const dateOnly = (v: any) => v ? new Date(v).toISOString().slice(0, 10) : null;
const num = (v: any, d = 0) => v == null || v === '' ? d : Number(v);
const arr = (v: any) => Array.isArray(v) ? v.map(String) : [];

async function tx<T>(pool: Pool, work: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await work(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}

async function main() {
  console.log('KVS MongoDB -> PostgreSQL CORE MIGRATION');
  console.log('Images intentionally skipped; R2 is a separate phase.');

  await connectMongo();
  if (!mongoose.connection.db) throw new Error('MongoDB connection has no DB handle.');

  const pool = new Pool({ connectionString: pgUrl, max: 4 });
  const check = await pool.query('SELECT current_database() db, current_user usr');
  console.log(`PostgreSQL: ${check.rows[0].db} / ${check.rows[0].usr}`);

  const users = new Map<string, number>();
  const products = new Map<string, number>();

  await tx(pool, async c => {
    const docs = await User.find({}).lean();
    console.log(`Users: ${docs.length}`);
    for (const d of docs) {
      const r = await c.query(`
        INSERT INTO users
        (legacy_mongo_id,name,email,password_hash,phone,is_admin,is_active,role,
         is_stall_registration,date_of_birth,anniversary_date,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (legacy_mongo_id) DO UPDATE SET
        name=EXCLUDED.name,email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,
        phone=EXCLUDED.phone,is_admin=EXCLUDED.is_admin,is_active=EXCLUDED.is_active,
        role=EXCLUDED.role,is_stall_registration=EXCLUDED.is_stall_registration,
        date_of_birth=EXCLUDED.date_of_birth,anniversary_date=EXCLUDED.anniversary_date,
        created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at
        RETURNING id`,
        [String(d._id), d.name, d.email, d.passwordHash, d.phone ?? null, d.isAdmin ?? false,
        d.isActive ?? true, d.role ?? null, d.isStallRegistration ?? false, dateOnly(d.dateOfBirth),
        dateOnly(d.anniversaryDate), date(d.createdAt), date(d.updatedAt)]);
      const id = Number(r.rows[0].id); users.set(String(d._id), id);

      for (const a of d.addresses ?? []) {
        await c.query(`
          INSERT INTO user_addresses
          (legacy_mongo_id,user_id,label,first_name,last_name,address,city,state,pincode,
           phone,is_default,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (legacy_mongo_id) DO UPDATE SET
          user_id=EXCLUDED.user_id,label=EXCLUDED.label,first_name=EXCLUDED.first_name,
          last_name=EXCLUDED.last_name,address=EXCLUDED.address,city=EXCLUDED.city,
          state=EXCLUDED.state,pincode=EXCLUDED.pincode,phone=EXCLUDED.phone,
          is_default=EXCLUDED.is_default,updated_at=EXCLUDED.updated_at`,
          [String(a._id), id, a.label ?? null, a.firstName, a.lastName, a.address, a.city,
          a.state, a.pincode, a.phone, a.isDefault ?? false,
          documentDate(d, 'createdAt'),
          documentDate(d, 'updatedAt')]);
      }
    }
  });

  await tx(pool, async c => {
    const docs = await Category.find({}).sort({ createdAt: 1 }).lean();
    console.log(`Categories: ${docs.length}`);
    for (const d of docs) {
      await c.query(`
        INSERT INTO categories (legacy_mongo_id,name,parent,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (legacy_mongo_id) DO UPDATE SET
        name=EXCLUDED.name,parent=EXCLUDED.parent,created_at=EXCLUDED.created_at,
        updated_at=EXCLUDED.updated_at`,
        [String(d._id), d.name, d.parent ?? null, date(d.createdAt), date(d.updatedAt)]);
    }
  });

  await tx(pool, async c => {
    const docs = await Product.find({}).sort({ createdAt: 1 }).lean();
    console.log(`Products: ${docs.length}`);
    for (const d of docs) {
      const charge = d.makingCharge ?? null, wastage = d.wastage ?? null;
      const r = await c.query(`
        INSERT INTO products
        (legacy_mongo_id,product_group_code,name,description,material,category,subcategory,
         tags,weight,price,original_price,purity,is_sale,is_featured,metal_value,making_charges,
         making_charge_percent,making_charge_per_gram,quantity,is_active,is_fixed_price,
         making_charge_type,making_charge_value,wastage_type,wastage_value,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
        ON CONFLICT (legacy_mongo_id) DO UPDATE SET
        product_group_code=EXCLUDED.product_group_code,name=EXCLUDED.name,
        description=EXCLUDED.description,material=EXCLUDED.material,category=EXCLUDED.category,
        subcategory=EXCLUDED.subcategory,tags=EXCLUDED.tags,weight=EXCLUDED.weight,
        price=EXCLUDED.price,original_price=EXCLUDED.original_price,purity=EXCLUDED.purity,
        is_sale=EXCLUDED.is_sale,is_featured=EXCLUDED.is_featured,metal_value=EXCLUDED.metal_value,
        making_charges=EXCLUDED.making_charges,making_charge_percent=EXCLUDED.making_charge_percent,
        making_charge_per_gram=EXCLUDED.making_charge_per_gram,quantity=EXCLUDED.quantity,
        is_active=EXCLUDED.is_active,is_fixed_price=EXCLUDED.is_fixed_price,
        making_charge_type=EXCLUDED.making_charge_type,making_charge_value=EXCLUDED.making_charge_value,
        wastage_type=EXCLUDED.wastage_type,wastage_value=EXCLUDED.wastage_value,
        created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at
        RETURNING id`,
        [String(d._id), d.productGroupCode, d.name, d.description ?? null, d.material ?? null,
        d.category ?? '', d.subcategory ?? null, arr(d.tags), num(d.weight), num(d.price),
        d.originalPrice == null ? null : num(d.originalPrice), d.purity ?? null, d.isSale ?? null,
        d.isFeatured ?? null, d.metalValue == null ? null : num(d.metalValue),
        d.makingCharges == null ? null : num(d.makingCharges),
        d.makingChargePercent == null ? null : num(d.makingChargePercent),
        d.makingChargePerGram == null ? null : num(d.makingChargePerGram), num(d.quantity),
        d.isActive ?? true, d.isFixedPrice ?? null, charge?.type ?? null,
        charge?.value == null ? null : num(charge.value), wastage?.type ?? null,
        wastage?.value == null ? null : num(wastage.value), date(d.createdAt), date(d.updatedAt)]);
      const productId = Number(r.rows[0].id); products.set(String(d._id), productId);

      await c.query('DELETE FROM product_variants WHERE product_id=$1', [productId]);
      for (const [i, v] of (d.variants ?? []).entries()) {
        await c.query(`
          INSERT INTO product_variants
          (legacy_mongo_id,product_id,label,weight,height,breadth,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (legacy_mongo_id) DO UPDATE SET
          product_id=EXCLUDED.product_id,label=EXCLUDED.label,weight=EXCLUDED.weight,
          height=EXCLUDED.height,breadth=EXCLUDED.breadth,updated_at=EXCLUDED.updated_at`,
          [`${String(d._id)}:variant:${i}`, productId, v.label, v.weight,
          v.height ?? null, v.breadth ?? null, date(d.createdAt), date(d.updatedAt)]);
      }
    }
  });

  await tx(pool, async c => {
    const docs = await Cart.find({}).lean();
    console.log(`Carts: ${docs.length}`);
    for (const d of docs) {
      const userId = users.get(String(d.userId));
      if (!userId) throw new Error(`Cart ${d._id}: user ${d.userId} not migrated.`);
      const r = await c.query(`
        INSERT INTO carts (legacy_mongo_id,user_id,created_at,updated_at)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (legacy_mongo_id) DO UPDATE SET
        user_id=EXCLUDED.user_id,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at
        RETURNING id`,
        [String(d._id), userId, documentDate(d, 'createdAt'), documentDate(d, 'updatedAt')]);
      const cartId = Number(r.rows[0].id);
      await c.query('DELETE FROM cart_items WHERE cart_id=$1', [cartId]);
      for (const item of d.items ?? []) {
        const productId = products.get(String(item.productId));
        if (!productId) throw new Error(`Cart ${d._id}: product ${item.productId} not migrated.`);
        await c.query(`
          INSERT INTO cart_items
          (legacy_mongo_id,cart_id,product_id,product_group_code,product_name,quantity,
           weight,unit_price,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (legacy_mongo_id) DO UPDATE SET
          cart_id=EXCLUDED.cart_id,product_id=EXCLUDED.product_id,
          product_group_code=EXCLUDED.product_group_code,product_name=EXCLUDED.product_name,
          quantity=EXCLUDED.quantity,weight=EXCLUDED.weight,unit_price=EXCLUDED.unit_price,
          updated_at=EXCLUDED.updated_at`,
          [String(item._id), cartId, productId, item.productGroupCode ?? '',
          item.productName ?? '', num(item.quantity), num(item.weight), num(item.unitPrice),
          documentDate(d, 'createdAt'),
          documentDate(d, 'updatedAt')]);
      }
    }
  });

  await tx(pool, async c => {
    const rates = await MetalRate.find({}).sort({ date: 1 }).lean();
    console.log(`Metal rates: ${rates.length}`);
    for (const d of rates) {
      await c.query(`
        INSERT INTO metal_rates
        (legacy_mongo_id,rate_date,metal,karat,rate_per_gram,rate_per_kg,updated_by,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (legacy_mongo_id) DO UPDATE SET
        rate_date=EXCLUDED.rate_date,metal=EXCLUDED.metal,karat=EXCLUDED.karat,
        rate_per_gram=EXCLUDED.rate_per_gram,rate_per_kg=EXCLUDED.rate_per_kg,
        updated_by=EXCLUDED.updated_by,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at`,
        [String(d._id), dateOnly(d.date), d.metal, d.karat ?? null, num(d.ratePerGram),
        num(d.ratePerKg), d.updatedBy ?? null, date(d.createdAt), date(d.updatedAt)]);
    }

    const statuses = await RateStatus.find({}).lean();
    console.log(`Rate status: ${statuses.length}`);
    for (const d of statuses) {
      await c.query(`
        INSERT INTO rate_status
        (
          legacy_mongo_id,
          key,
          blocked,
          stale_metals,
          checked_at,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (key) DO UPDATE SET
          legacy_mongo_id = EXCLUDED.legacy_mongo_id,
          blocked = EXCLUDED.blocked,
          stale_metals = EXCLUDED.stale_metals,
          checked_at = EXCLUDED.checked_at,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
        `,
        [
          String(d._id),
          d.key ?? 'global',
          d.blocked ?? false,
          arr(d.staleMetals),
          date(d.checkedAt),
          date(d.createdAt),
          date(d.updatedAt),
        ],
      );
    }

    const configs = await StoreConfig.find({}).lean();
    console.log(`Store config: ${configs.length}`);
    for (const d of configs) {
      await c.query(`
        INSERT INTO store_config
        (
          legacy_mongo_id,
          key,
          theme,
          is_dark,
          marquee_messages,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (key) DO UPDATE SET
          legacy_mongo_id = EXCLUDED.legacy_mongo_id,
          theme = EXCLUDED.theme,
          is_dark = EXCLUDED.is_dark,
          marquee_messages = EXCLUDED.marquee_messages,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
        `,
        [
          String(d._id),
          d.key ?? 'global',
          d.theme ?? 'icy-silver',
          d.isDark ?? false,
          arr(d.marqueeMessages),
          documentDate(d, 'createdAt'),
          documentDate(d, 'updatedAt'),
        ],
      );
    }
  });

  await pool.end();
  await disconnectMongo();
  console.log('');
  console.log('CORE MIGRATION COMPLETE');
  console.log('Users, addresses, categories, products, variants, carts, cart items, metal rates, rate status and store config migrated.');
  console.log('Product images were intentionally NOT migrated. They require the R2 stage.');
}

main().catch(async e => {
  console.error('MIGRATION FAILED');
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  await disconnectMongo().catch(() => undefined);
  process.exitCode = 1;
});
