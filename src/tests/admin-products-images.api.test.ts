import { ProductService } from '../services/product.service';
import { ProductRepository } from '../repositories/product.repository';
import { InventoryRepository } from '../repositories/inventory.repository';

// Exercises the real create/update normalization (service + repository payload),
// mocking only the data-access layer per the project's testing convention.
describe('Product images write-side normalization', () => {
  afterEach(() => jest.restoreAllMocks());

  const baseCreate = {
    name: 'Ring',
    category: 'Silver',
    weightGm: 10,
    price: 1000,
    quantity: 2,
  };

  function captureCreate() {
    const spy = jest
      .spyOn(ProductRepository.prototype, 'create')
      .mockImplementation(async (data: any) => ({ _id: 'p1', quantity: data.quantity ?? 0, ...data }) as never);
    jest.spyOn(InventoryRepository.prototype, 'ensureStock').mockResolvedValue(undefined as never);
    return spy;
  }

  it('normalizes an images array into ordered { imageBase64, sortOrder } docs on create', async () => {
    const spy = captureCreate();
    await new ProductService().createProduct({
      ...baseCreate,
      image: 'data:img0',
      images: ['data:img0', 'data:img1', 'data:img2'],
    });

    const payload = spy.mock.calls[0][0] as any;
    expect(payload.images).toEqual([
      { variantName: 'Default view', imageBase64: 'data:img0', sortOrder: 0 },
      { variantName: 'Default view', imageBase64: 'data:img1', sortOrder: 1 },
      { variantName: 'Default view', imageBase64: 'data:img2', sortOrder: 2 },
    ]);
  });

  it('falls back to the single image field when no images array is sent', async () => {
    const spy = captureCreate();
    await new ProductService().createProduct({ ...baseCreate, image: 'data:only' });

    const payload = spy.mock.calls[0][0] as any;
    expect(payload.images).toEqual([{ variantName: 'Default view', imageBase64: 'data:only', sortOrder: 0 }]);
  });

  it('drops blank entries and rejects non-string entries', async () => {
    const spy = captureCreate();
    await new ProductService().createProduct({ ...baseCreate, images: ['a', '  ', '', 'b'] });
    expect((spy.mock.calls[0][0] as any).images.map((i: any) => i.imageBase64)).toEqual(['a', 'b']);

    await expect(
      new ProductService().createProduct({ ...baseCreate, images: ['a', 123] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('full-replaces images on update and clears them with an empty array', async () => {
    const spy = jest
      .spyOn(ProductRepository.prototype, 'update')
      .mockImplementation(async (_id: string, data: any) => ({ _id, ...data }) as never);

    await new ProductService().updateProduct('p1', { images: ['x', 'y'] });
    expect((spy.mock.calls[0][1] as any).images).toEqual([
      { variantName: 'Default view', imageBase64: 'x', sortOrder: 0 },
      { variantName: 'Default view', imageBase64: 'y', sortOrder: 1 },
    ]);

    await new ProductService().updateProduct('p1', { images: [] });
    expect((spy.mock.calls[1][1] as any).images).toEqual([]);
  });
});
