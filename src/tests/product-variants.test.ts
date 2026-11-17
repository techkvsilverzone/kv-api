import { ProductService } from '../services/product.service';

// normalizeVariants is the validation every product create/update runs on its sizes.
const normalize = (rows: unknown) =>
  (new ProductService() as unknown as { normalizeVariants(r: unknown): Array<Record<string, string>> }).normalizeVariants(rows);

describe('product sizes / weights', () => {
  it('accepts several weights of the same product with no size label (label defaults to the weight)', () => {
    expect(normalize([
      { label: '3.15 Inch', weight: '16.8gm', height: '8cm' },
      { label: '', weight: '20gm' },
      { weight: '25gm' },
      { label: '', weight: '', height: '', breadth: '' }, // empty row dropped
    ])).toEqual([
      { label: '3.15 Inch', weight: '16.8gm', height: '8cm' },
      { label: '20gm', weight: '20gm' },
      { label: '25gm', weight: '25gm' },
    ]);
  });

  it('still requires a weight, which prices the size', () => {
    expect(() => normalize([{ label: 'L', weight: '' }])).toThrow(/"L" needs a weight/);
  });
});
