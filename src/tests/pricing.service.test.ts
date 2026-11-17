import { PricingService, resolvePurityFraction, resolveDeliveryZone, GIFT_WRAP_FEE, metalOf } from '../services/pricing.service';
import { IProduct } from '../domain/catalog';
import { ProductRepository } from '../repositories/product.repository';
import { PricingConfigRepository } from '../repositories/pricingConfig.repository';

const makeProduct = (overrides: Partial<IProduct>): IProduct =>
  ({
    name: 'Test',
    material: 'Silver',
    weight: 10,
    price: 5000,
    purity: '925',
    quantity: 10,
    isActive: true,
    ...overrides,
  } as unknown as IProduct);

describe('resolvePurityFraction', () => {
  it('parses 3-digit millesimal purity (925 -> 0.925, 999 -> 0.999)', () => {
    expect(resolvePurityFraction('925', 'Silver')).toBeCloseTo(0.925);
    expect(resolvePurityFraction('999', 'Silver')).toBeCloseTo(0.999);
  });

  it('parses percentage-style purity (92.5 -> 0.925)', () => {
    expect(resolvePurityFraction('92.5', 'Silver')).toBeCloseTo(0.925);
  });

  it('extracts digits from labelled purity ("Silver 925" -> 0.925)', () => {
    expect(resolvePurityFraction('Silver 925', 'Silver')).toBeCloseTo(0.925);
  });

  it('defaults silver without purity to 0.925 and non-silver to 1', () => {
    expect(resolvePurityFraction(undefined, 'Silver')).toBeCloseTo(0.925);
    expect(resolvePurityFraction(undefined, 'Gold')).toBe(1);
  });
});

describe('PricingService.computeUnitPrice', () => {
  const service = new PricingService();

  it('sells a charge-less product at its listed price, as the repository returns it (null legacy fields)', () => {
    // Exactly what ProductRepository yields for "Wooden Aarathi": no charges, legacy columns null.
    const product = makeProduct({
      price: 650, weight: 4.2, purity: '999', isFixedPrice: false,
      makingCharge: null, wastage: null, makingCharges: null, makingChargePercent: null, makingChargePerGram: null,
    } as unknown as Partial<IProduct>);
    const b = service.computeUnitPrice(product, 230);
    expect(b.basis).toBe('static');
    expect(b.unitPrice).toBe(650);
  });

  it('still prices live when a legacy charge is set, including an explicit 0', () => {
    const zero = makeProduct({ price: 650, weight: 4.2, purity: '999', makingCharges: 0, makingChargePercent: null, makingChargePerGram: null } as unknown as Partial<IProduct>);
    expect(service.computeUnitPrice(zero, 230).basis).toBe('live');
    const perGram = makeProduct({ weight: 10, purity: '925', makingChargePercent: null, makingChargePerGram: 50, makingCharges: null } as unknown as Partial<IProduct>);
    // metal 1000 + making 50 x 10 = 1500: per-gram wins over a null percent.
    expect(service.computeUnitPrice(perGram, 100).unitPrice).toBeCloseTo(1500);
  });

  it('computes live price = weight x rate + making% (purity is not applied: the rate is already for the purity sold)', () => {
    const product = makeProduct({ weight: 10, purity: '925', makingChargePercent: 10 });
    const b = service.computeUnitPrice(product, 100); // 100/g
    // metalValue = 10 * 100 = 1000; making = 100; unit = 1100
    expect(b.basis).toBe('live');
    expect(b.metalValue).toBeCloseTo(1000);
    expect(b.makingCharge).toBeCloseTo(100);
    expect(b.unitPrice).toBeCloseTo(1100);
  });

  it('uses making charge per gram when provided', () => {
    const product = makeProduct({ weight: 10, purity: '925', makingChargePerGram: 50 });
    const b = service.computeUnitPrice(product, 100);
    // metalValue = 1000; making = 50 * 10 = 500; unit = 1500
    expect(b.unitPrice).toBeCloseTo(1500);
  });

  it('falls back to static listed price when no silver rate is available', () => {
    const product = makeProduct({ price: 5000, makingChargePercent: 10 });
    const b = service.computeUnitPrice(product, null);
    expect(b.basis).toBe('static');
    expect(b.unitPrice).toBe(5000);
  });

  it('falls back to static price when product has no making-charge inputs', () => {
    const product = makeProduct({ price: 4200, makingChargePercent: undefined, makingChargePerGram: undefined, makingCharges: undefined });
    const b = service.computeUnitPrice(product, 100);
    expect(b.basis).toBe('static');
    expect(b.unitPrice).toBe(4200);
  });

  it('uses the listed price for fixed-price products (no metal calc)', () => {
    const product = makeProduct({
      isFixedPrice: true,
      price: 7999,
      weight: 10,
      makingCharge: { type: 'percentage', value: 10 },
    });
    const b = service.computeUnitPrice(product, 100);
    expect(b.basis).toBe('fixed');
    expect(b.unitPrice).toBe(7999);
    expect(b.makingCharge).toBe(0);
    expect(b.wastage).toBe(0);
  });

  it('applies makingCharge + wastage config as percentages of metal value', () => {
    const product = makeProduct({
      weight: 10,
      purity: '925',
      makingCharge: { type: 'percentage', value: 10 },
      wastage: { type: 'percentage', value: 5 },
    });
    const b = service.computeUnitPrice(product, 100);
    // metalValue = 1000; making = 100; wastage = 50; unit = 1150
    expect(b.basis).toBe('live');
    expect(b.metalValue).toBeCloseTo(1000);
    expect(b.makingCharge).toBeCloseTo(100);
    expect(b.wastage).toBeCloseTo(50);
    expect(b.unitPrice).toBeCloseTo(1150);
  });

  it('applies makingCharge config as a flat amount and wastage as percentage', () => {
    const product = makeProduct({
      weight: 10,
      purity: '925',
      makingCharge: { type: 'amount', value: 300 },
      wastage: { type: 'amount', value: 50 },
    });
    const b = service.computeUnitPrice(product, 100);
    // metalValue = 1000; making = 300; wastage = 50; unit = 1350
    expect(b.makingCharge).toBeCloseTo(300);
    expect(b.wastage).toBeCloseTo(50);
    expect(b.unitPrice).toBeCloseTo(1350);
  });

  it('prefers the new makingCharge config over legacy making fields', () => {
    const product = makeProduct({
      weight: 10,
      purity: '925',
      makingChargePercent: 10, // legacy — should be ignored
      makingCharge: { type: 'percentage', value: 20 },
    });
    const b = service.computeUnitPrice(product, 100);
    // making = 20% of 1000 = 200 (not the legacy 100)
    expect(b.makingCharge).toBeCloseTo(200);
  });

  it('honours a selected size-variant weight override', () => {
    const product = makeProduct({ weight: 10, purity: '925', makingChargePercent: 10 });
    const b = service.computeUnitPrice(product, 100, 20); // 20g variant
    // metalValue = 20 * 100 = 2000; making = 200; unit = 2200
    expect(b.metalValue).toBeCloseTo(2000);
    expect(b.unitPrice).toBeCloseTo(2200);
  });
});

describe('owner example', () => {
  it('16.8 g at ₹190/g is ₹3,192 (not ₹2,953 after a purity factor)', () => {
    const b = new PricingService().computeUnitPrice(makeProduct({ weight: 16.8, purity: '925', makingChargePercent: 0 }), 190);
    expect(b.unitPrice).toBe(3192);
  });
});

describe('resolveDeliveryZone', () => {
  it('maps Chennai city to the chennai zone', () => {
    expect(resolveDeliveryZone({ city: 'Chennai', state: 'Tamil Nadu' })).toBe('chennai');
  });

  it('maps other Tamil Nadu cities to otherDistrict', () => {
    expect(resolveDeliveryZone({ city: 'Coimbatore', state: 'Tamil Nadu' })).toBe('otherDistrict');
  });

  it('maps non-Tamil-Nadu addresses to otherState', () => {
    expect(resolveDeliveryZone({ city: 'Bengaluru', state: 'Karnataka' })).toBe('otherState');
  });

  it('returns null when no address is supplied', () => {
    expect(resolveDeliveryZone(null)).toBeNull();
    expect(resolveDeliveryZone({})).toBeNull();
  });
});

describe('PricingService.computeCheckout — variant weight passthrough', () => {
  const service = new PricingService();
  const variantProduct = makeProduct({
    _id: { toString: () => 'p1' },
    weight: 10,
    purity: '925',
    productGroupCode: 'GRP-1',
    makingCharge: { type: 'percentage', value: 10 },
  } as unknown as Partial<IProduct>);

  afterEach(() => jest.restoreAllMocks());

  it('prices a checkout line at the selected variant weight, exactly as the frontend cart sends it', async () => {
    jest.spyOn(service, 'getCurrentRatePerGram').mockResolvedValue(100);
    jest.spyOn(ProductRepository.prototype, 'findById').mockResolvedValue(variantProduct as never);
    jest.spyOn(PricingConfigRepository.prototype, 'getGstPercent').mockResolvedValue(3);

    // Two lines for the SAME product — one at the base 10g weight, one at a 20g variant —
    // mirroring `Payment.tsx`'s `items.map(item => ({ product, quantity, weight: item.weight }))`.
    const breakdown = await service.computeCheckout({
      items: [
        { product: 'p1', quantity: 1 },
        { product: 'p1', quantity: 1, weight: '20g' },
      ],
    });

    // Base: metalValue = 10*100 = 1000, making 10% = 100, unit = 1100
    expect(breakdown.items[0].weight).toBe(10);
    expect(breakdown.items[0].price).toBeCloseTo(1100);
    // 20g variant: metalValue = 20*100 = 2000, making 10% = 200, unit = 2200
    expect(breakdown.items[1].weight).toBe(20);
    expect(breakdown.items[1].price).toBeCloseTo(2200);
    expect(breakdown.subtotal).toBeCloseTo(1100 + 2200);
  });
});

describe('PricingService.computeCheckout — gift wrap', () => {
  const service = new PricingService();
  const product = makeProduct({
    _id: { toString: () => 'p1' },
    weight: 10,
    purity: '925',
    productGroupCode: 'GRP-1',
    makingCharge: { type: 'percentage', value: 10 },
  } as unknown as Partial<IProduct>);

  afterEach(() => jest.restoreAllMocks());

  it('adds the flat server-owned fee after GST, and nothing without gift wrap', async () => {
    jest.spyOn(service, 'getCurrentRatePerGram').mockResolvedValue(100);
    jest.spyOn(ProductRepository.prototype, 'findById').mockResolvedValue(product as never);
    jest.spyOn(PricingConfigRepository.prototype, 'getGstPercent').mockResolvedValue(3);

    const plain = await service.computeCheckout({ items: [{ product: 'p1', quantity: 1 }] });
    const wrapped = await service.computeCheckout({ items: [{ product: 'p1', quantity: 1 }], giftWrap: true });

    expect(plain.giftWrapFee).toBe(0);
    expect(wrapped.giftWrap).toBe(true);
    expect(wrapped.giftWrapFee).toBe(GIFT_WRAP_FEE);
    expect(wrapped.taxAmount).toBeCloseTo(plain.taxAmount); // the fee is not taxed
    expect(wrapped.grandTotal).toBeCloseTo(plain.grandTotal + 99);
    expect(wrapped.amountInPaise).toBe(Math.round(wrapped.grandTotal * 100));
  });
});

describe('gold pricing', () => {
  const service = new PricingService();
  afterEach(() => jest.restoreAllMocks());

  it('picks the gold rate for gold materials (karat purity is still parsed for display)', () => {
    expect(resolvePurityFraction('22K', 'Gold')).toBeCloseTo(22 / 24);
    expect(resolvePurityFraction('18 kt', 'Gold')).toBeCloseTo(0.75);
    expect(resolvePurityFraction('916', 'Gold')).toBeCloseTo(0.916);
    expect(metalOf({ material: 'Gold 22K' })).toBe('GOLD');
    expect(metalOf({ material: 'Silver' })).toBe('SILVER');
    expect(metalOf({ material: null })).toBe('SILVER');
  });

  it('prices a gold line at the gold rate in checkout', async () => {
    const rate = jest.spyOn(service, 'getCurrentRatePerGram').mockImplementation(async (m) => (m === 'GOLD' ? 7000 : 100));
    jest.spyOn(ProductRepository.prototype, 'findById').mockResolvedValue(
      makeProduct({ _id: { toString: () => 'g1' }, material: 'Gold 22K', purity: '22K', weight: 2, makingChargePercent: 10 } as unknown as Partial<IProduct>) as never,
    );
    jest.spyOn(PricingConfigRepository.prototype, 'getGstPercent').mockResolvedValue(3);
    const b = await service.computeCheckout({ items: [{ product: 'g1', quantity: 1 }] });
    // 2 g × 7000 (the 22K rate) = 14000 + 10% = 15400
    expect(b.items[0].price).toBeCloseTo(15400, 1);
    expect(rate).toHaveBeenCalledWith('GOLD');
  });
});
