import { PricingService, resolvePurityFraction } from '../services/pricing.service';
import { IProduct } from '../models/product.model';

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
});
