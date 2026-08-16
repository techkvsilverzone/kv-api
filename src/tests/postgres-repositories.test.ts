import * as pool from '../infrastructure/postgres/pool';
import { UserRepository } from '../repositories/user.repository';
import { ProductRepository } from '../repositories/product.repository';
import { CouponRepository } from '../repositories/coupon.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { OrderRepository } from '../repositories/order.repository';
import { StallConfigRepository } from '../repositories/stallConfig.repository';
import { MetalRateRepository } from '../repositories/metalrate.repository';
import { istDayKey, istMidnightUtc } from '../utils/time';

/**
 * PostgreSQL repository coverage (spec §34): get-by-id, list, update, delete,
 * sorting, not-found, constraint violations, invalid identifiers, and the
 * row→domain mapping. Pagination and filtering are covered separately in
 * product-pagination.repo.test.ts; transactions in postgres-pool.test.ts and
 * savings-ledger.test.ts.
 *
 * The pool is mocked, so these run without a database — the same convention the
 * rest of the suite uses.
 */
describe('PostgreSQL repositories', () => {
  let calls: Array<{ sql: string; params: readonly unknown[] }>;

  /** Stub the pool, returning `rows` for every read. */
  const stub = (rows: any[] = []) => {
    calls = [];
    const record = (sql: string, params: readonly unknown[] = []) => {
      calls.push({ sql, params });
    };

    jest.spyOn(pool, 'queryRows').mockImplementation(async (sql, params = []) => {
      record(sql, params);
      return rows as never[];
    });
    jest.spyOn(pool, 'queryOne').mockImplementation(async (sql, params = []) => {
      record(sql, params);
      return (rows[0] ?? null) as never;
    });
    jest.spyOn(pool, 'query').mockImplementation(async (sql, params = []) => {
      record(sql, params);
      return { rows, rowCount: rows.length } as never;
    });
  };

  const lastSql = () => calls[calls.length - 1].sql;

  afterEach(() => jest.restoreAllMocks());

  describe('identifier handling', () => {
    // A Mongo ObjectId can still arrive from an old client, a stale cookie, or a
    // bookmarked URL. It must read as "not found", never as a 500 from
    // PostgreSQL's "invalid input syntax for type bigint".
    const LEGACY_OBJECT_ID = '69b15096631b43ff2de76aa2';

    it('treats a legacy Mongo ObjectId as not-found without issuing a query', async () => {
      stub([]);

      expect(await new UserRepository().findById(LEGACY_OBJECT_ID)).toBeNull();
      expect(await new ProductRepository().findById(LEGACY_OBJECT_ID)).toBeNull();
      expect(await new CouponRepository().findById(LEGACY_OBJECT_ID)).toBeNull();
      expect(await new OrderRepository().findById(LEGACY_OBJECT_ID)).toBeNull();
      expect(calls).toHaveLength(0);
    });

    it('treats a non-numeric id as not-found on delete paths too', async () => {
      stub([]);

      expect(await new ProductRepository().delete('not-an-id')).toBeNull();
      expect(await new CouponRepository().delete('not-an-id')).toBe(false);
      expect(calls).toHaveLength(0);
    });

    it('accepts a numeric id and binds it as a parameter', async () => {
      stub([]);

      await new UserRepository().findById('12');

      expect(calls[0].params).toEqual(['12']);
      expect(calls[0].sql).toMatch(/WHERE u\.id = \$1/);
    });
  });

  describe('not found', () => {
    it('returns null from findById when no row matches', async () => {
      stub([]);
      expect(await new ProductRepository().findById('999')).toBeNull();
    });

    it('returns an empty list rather than null from list queries', async () => {
      stub([]);
      expect(await new CouponRepository().findAll()).toEqual([]);
      expect(await new UserRepository().findAll()).toEqual([]);
    });

    it('reports false when a delete affects no rows', async () => {
      stub([]);
      expect(await new CouponRepository().delete('5')).toBe(false);
    });
  });

  describe('row → domain mapping', () => {
    it('maps a user row, aggregating addresses into the nested array', async () => {
      stub([
        {
          id: '7',
          name: 'Asha',
          email: 'asha@example.com',
          password_hash: '$2a$10$hash',
          phone: '9876543210',
          is_admin: false,
          is_active: true,
          role: null,
          is_stall_registration: false,
          date_of_birth: '1990-05-12',
          anniversary_date: null,
          created_at: new Date('2026-01-01T00:00:00Z'),
          updated_at: new Date('2026-01-02T00:00:00Z'),
          addresses: [
            {
              _id: '31',
              label: 'Home',
              firstName: 'Asha',
              lastName: 'R',
              address: '12 Mount Road',
              city: 'Chennai',
              state: 'Tamil Nadu',
              pincode: '600002',
              phone: '9876543210',
              isDefault: true,
            },
          ],
        },
      ]);

      const user = await new UserRepository().findById('7');

      expect(user).toMatchObject({
        _id: '7',
        name: 'Asha',
        isAdmin: false,
        isActive: true,
      });
      expect(user!.addresses).toHaveLength(1);
      expect(user!.addresses[0]._id).toBe('31');
      // A DATE column is a calendar day; it must serialise as UTC midnight, not
      // drift a day either side on a non-UTC server.
      expect(user!.dateOfBirth?.toISOString()).toBe('1990-05-12T00:00:00.000Z');
    });

    it('maps a product row, nesting variants and images and sourcing images from image_url', async () => {
      stub([
        {
          id: '3',
          product_group_code: 'RING01',
          name: 'Silver Ring',
          description: null,
          material: '925 Silver',
          category: 'Jewellery',
          subcategory: 'Womens',
          tags: ['gift'],
          weight: 10.5,
          price: 5000,
          original_price: null,
          purity: '925',
          is_sale: null,
          is_featured: true,
          metal_value: null,
          making_charges: null,
          making_charge_percent: null,
          making_charge_per_gram: null,
          quantity: 4,
          is_active: true,
          is_fixed_price: false,
          making_charge_type: 'percentage',
          making_charge_value: 12,
          wastage_type: null,
          wastage_value: null,
          created_at: new Date('2026-01-01T00:00:00Z'),
          updated_at: new Date('2026-01-01T00:00:00Z'),
          variants: [{ label: 'S', weight: '10.5', height: null, breadth: null }],
          images: [
            {
              imageUrl: '/images/products/3/001-ab34cd12.webp',
              imageBase64: '/images/products/3/001-ab34cd12.webp',
              variantName: 'Default view',
              sortOrder: 0,
            },
          ],
        },
      ]);

      const product = await new ProductRepository().findById('3');

      expect(product).toMatchObject({ _id: '3', productGroupCode: 'RING01', weight: 10.5 });
      // A charge is only meaningful when both columns are set.
      expect(product!.makingCharge).toEqual({ type: 'percentage', value: 12 });
      expect(product!.wastage).toBeNull();
      // height/breadth are omitted rather than null when unset.
      expect(product!.variants[0]).toEqual({ label: 'S', weight: '10.5' });
      // No base64 is ever read back — both keys carry the public URL (spec §13, §36).
      expect(product!.images[0].imageUrl).toBe('/images/products/3/001-ab34cd12.webp');
      expect(product!.images[0].imageBase64).toBe(product!.images[0].imageUrl);
    });

    it('keeps a coupon maxUses of 0 as 0, meaning unlimited (spec §24)', async () => {
      stub([
        {
          id: '1',
          code: 'STALL10',
          discount_type: 'percentage',
          discount_value: 10,
          min_order_amount: 0,
          max_uses: 0,
          used_count: 3,
          expiry_date: new Date('2026-12-31T00:00:00Z'),
          is_active: true,
          created_at: null,
          updated_at: null,
        },
      ]);

      const coupon = await new CouponRepository().findByCode('stall10');

      expect(coupon!.maxUses).toBe(0);
      expect(coupon!.maxUses).not.toBeNull();
      // Lookup is case-normalised, as it always was.
      expect(calls[0].params).toEqual(['STALL10']);
    });

    it('maps the stall config is_enabled column onto the `active` field', async () => {
      stub([{ id: '1', key: 'global', is_enabled: true, created_at: null, updated_at: null }]);

      expect(await new StallConfigRepository().getConfig()).toEqual({ active: true });
    });

    it('falls back to defaults when a single-row config is absent', async () => {
      stub([]);
      expect(await new StallConfigRepository().getConfig()).toEqual({ active: false });
    });
  });

  describe('sorting', () => {
    it('orders products newest-first with a stable tiebreaker for sortBy=newest', async () => {
      stub([]);
      await new ProductRepository().findAll({ sortBy: 'newest' });
      expect(lastSql()).toMatch(/ORDER BY p\.created_at DESC, p\.id ASC/);
    });

    it('orders products by price ascending for sortBy=price_asc', async () => {
      stub([]);
      await new ProductRepository().findAll({ sortBy: 'price_asc' });
      expect(lastSql()).toMatch(/ORDER BY p\.price ASC/);
    });

    it('defaults to product group code order', async () => {
      stub([]);
      await new ProductRepository().findAll({});
      expect(lastSql()).toMatch(/ORDER BY p\.product_group_code ASC/);
    });

    it('lists users newest-first', async () => {
      stub([]);
      await new UserRepository().findAll();
      expect(lastSql()).toMatch(/ORDER BY u\.created_at DESC/);
    });

    it('puts top-level categories (null parent) first, as the Mongo sort did', async () => {
      stub([]);
      await new CategoryRepository().findAll();
      expect(lastSql()).toMatch(/ORDER BY parent ASC NULLS FIRST, name ASC/);
    });
  });

  describe('update semantics', () => {
    it('only writes the columns present on the patch', async () => {
      stub([{ id: '4' }]);

      await new CouponRepository().update('4', { discountValue: 25 });

      const update = calls.find((c) => /UPDATE coupons SET/.test(c.sql))!;
      // Compare the SET clause only — RETURNING legitimately names every column.
      const setClause = update.sql.split('WHERE')[0];
      expect(setClause).toMatch(/discount_value = \$1/);
      expect(setClause).not.toMatch(/min_order_amount/);
      expect(setClause).not.toMatch(/max_uses/);
      expect(update.params).toEqual([25, '4']);
    });

    it('ignores keys that are not on the update whitelist', async () => {
      stub([{ id: '4' }]);

      await new UserRepository().update('4', { name: 'Asha', isAdmin: true } as never);

      const update = calls.find((c) => /UPDATE users SET/.test(c.sql))!;
      const setClause = update.sql.split('WHERE')[0];
      expect(setClause).toMatch(/name = \$1/);
      expect(setClause).toMatch(/is_admin = \$2/);
      // Nothing outside UPDATABLE_COLUMNS can reach the statement, which is what
      // makes forwarding a raw request body safe.
      expect(setClause).not.toMatch(/password_hash/);
    });

    it('normalises an email to lower case before the uniqueness check and the write', async () => {
      stub([]);

      await new UserRepository().update('4', { email: '  Asha@Example.COM ' });

      const clash = calls.find((c) => /SELECT id FROM users WHERE email/.test(c.sql))!;
      expect(clash.params).toEqual(['asha@example.com', '4']);
    });

    it('rejects an email already used by another account', async () => {
      stub([{ id: '99' }]);

      await expect(new UserRepository().update('4', { email: 'taken@example.com' })).rejects.toThrow(
        'Email already in use',
      );
    });
  });

  describe('constraint-aware writes', () => {
    it('restates the partial-index expression when upserting a category', async () => {
      stub([]);
      await new CategoryRepository().create('Mens', 'Jewellery');

      // The unique index is on (name, COALESCE(parent, '')), so a bare
      // ON CONFLICT (name, parent) would not match it.
      expect(calls[0].sql).toMatch(/ON CONFLICT \(name, COALESCE\(parent, ''\)\) DO NOTHING/);
      expect(calls[0].params).toEqual(['Mens', 'Jewellery']);
    });

    it('matches a null parent with IS NOT DISTINCT FROM when deleting a category', async () => {
      stub([]);
      await new CategoryRepository().delete('Coins', null);

      expect(calls[0].sql).toMatch(/parent IS NOT DISTINCT FROM \$2/);
      expect(calls[0].params).toEqual(['Coins', null]);
    });

    it('restates the karat expression in the metal-rate conflict target', async () => {
      stub([
        {
          id: '1',
          rate_date: istDayKey(),
          metal: 'SILVER',
          karat: null,
          rate_per_gram: 95.5,
          rate_per_kg: 95500,
          updated_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      await new MetalRateRepository().upsertRate({
        date: istMidnightUtc(istDayKey()),
        metal: 'SILVER',
        karat: null,
        ratePerGram: 95.5,
      });

      expect(calls[0].sql).toMatch(/ON CONFLICT \(rate_date, metal, COALESCE\(karat, -1\)\)/);
      // rate_per_kg is derived, never trusted from the caller.
      expect(calls[0].params[4]).toBe(95500);
    });

    it('stores a metal rate against the IST calendar day, not the UTC date of IST midnight', async () => {
      stub([
        {
          id: '2',
          rate_date: '2026-06-15',
          metal: 'GOLD',
          karat: 22,
          rate_per_gram: 8000,
          rate_per_kg: 8000000,
          updated_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      // 2026-06-15T00:00+05:30 is 2026-06-14T18:30Z — slicing the ISO string
      // would file this a day early.
      const istMidnight = istMidnightUtc('2026-06-15');

      await new MetalRateRepository().upsertRate({
        date: istMidnight,
        metal: 'GOLD',
        karat: 22,
        ratePerGram: 8000,
      });

      expect(calls[0].params[0]).toBe('2026-06-15');
    });
  });

  describe('stock decrement is conditional, not read-then-write', () => {
    it('refuses to decrement below the requested quantity in a single statement', async () => {
      stub([]);

      const ok = await new InventoryRepository().decrementStockAtomic('3', 2);

      expect(ok).toBe(false);
      expect(calls[0].sql).toMatch(/WHERE product_id = \$1 AND current_stock >= \$2/);
      expect(calls[0].params).toEqual(['3', 2]);
    });

    it('reports success when a row was affected', async () => {
      stub([{ id: '1' }]);
      expect(await new InventoryRepository().decrementStockAtomic('3', 2)).toBe(true);
    });
  });

  describe('parameterisation', () => {
    it('binds a coupon code rather than interpolating it', async () => {
      stub([]);
      await new CouponRepository().findByCode("' OR 1=1 --");

      expect(calls[0].sql).not.toMatch(/OR 1=1/);
      expect(calls[0].params).toEqual(["' OR 1=1 --"]);
    });

    it('binds a product search term rather than interpolating it', async () => {
      stub([]);
      await new ProductRepository().findAll({ search: "'; DELETE FROM products; --" });

      expect(lastSql()).not.toMatch(/DELETE FROM products/);
      expect(calls[0].params).toContain("%'; DELETE FROM products; --%");
    });
  });
});
