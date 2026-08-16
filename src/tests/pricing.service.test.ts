import { PricingService, resolvePurityFraction, resolveDeliveryZone } from '../services/pricing.service';
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

  it('computes live price = weight x rate x purity + making% ', () => {
    const product = makeProduct({ weight: 10, purity: '925', makingChargePercent: 10 });
    const b = service.computeUnitPrice(product, 100); // 100/g
    // metalValue = 10 * 100 * 0.925 = 925; making = 92.5; unit = 1017.5
    expect(b.basis).toBe('live');
    expect(b.metalValue).toBeCloseTo(925);
    expect(b.makingCharge).toBeCloseTo(92.5);
    expect(b.unitPrice).toBeCloseTo(1017.5);
  });

  it('uses making charge per gram when provided', () => {
    const product = makeProduct({ weight: 10, purity: '925', makingChargePerGram: 50 });
    const b = service.computeUnitPrice(product, 100);
    // metalValue = 925; making = 50 * 10 = 500; unit = 1425
    expect(b.unitPrice).toBeCloseTo(1425);
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
    // metalValue = 925; making = 92.5; wastage = 46.25; unit = 1063.75
    expect(b.basis).toBe('live');
    expect(b.metalValue).toBeCloseTo(925);
    expect(b.makingCharge).toBeCloseTo(92.5);
    expect(b.wastage).toBeCloseTo(46.25);
    expect(b.unitPrice).toBeCloseTo(1063.75);
  });

  it('applies makingCharge config as a flat amount and wastage as percentage', () => {
    const product = makeProduct({
      weight: 10,
      purity: '925',
      makingCharge: { type: 'amount', value: 300 },
      wastage: { type: 'amount', value: 50 },
    });
    const b = service.computeUnitPrice(product, 100);
    // metalValue = 925; making = 300; wastage = 50; unit = 1275
    expect(b.makingCharge).toBeCloseTo(300);
    expect(b.wastage).toBeCloseTo(50);
    expect(b.unitPrice).toBeCloseTo(1275);
  });

  it('prefers the new makingCharge config over legacy making fields', () => {
    const product = makeProduct({
      weight: 10,
      purity: '925',
      makingChargePercent: 10, // legacy — should be ignored
      makingCharge: { type: 'percentage', value: 20 },
    });
    const b = service.computeUnitPrice(product, 100);
    // making = 20% of 925 = 185 (not the legacy 92.5)
    expect(b.makingCharge).toBeCloseTo(185);
  });

  it('honours a selected size-variant weight override', () => {
    const product = makeProduct({ weight: 10, purity: '925', makingChargePercent: 10 });
    const b = service.computeUnitPrice(product, 100, 20); // 20g variant
    // metalValue = 20 * 100 * 0.925 = 1850; making = 185; unit = 2035
    expect(b.metalValue).toBeCloseTo(1850);
    expect(b.unitPrice).toBeCloseTo(2035);
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
    jest.spyOn(service, 'getCurrentSilverRatePerGram').mockResolvedValue(100);
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

    // Base: metalValue = 10*100*0.925 = 925, making 10% = 92.5, unit = 1017.5
    expect(breakdown.items[0].weight).toBe(10);
    expect(breakdown.items[0].price).toBeCloseTo(1017.5);
    // 20g variant: metalValue = 20*100*0.925 = 1850, making 10% = 185, unit = 2035
    expect(breakdown.items[1].weight).toBe(20);
    expect(breakdown.items[1].price).toBeCloseTo(2035);
    expect(breakdown.subtotal).toBeCloseTo(1017.5 + 2035);
  });
});
