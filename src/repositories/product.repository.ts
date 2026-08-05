import mongoose from 'mongoose';
import { Product, IProduct } from '../models/product.model';
import { AppError } from '../utils/appError';

export class ProductRepository {
  /**
   * Coerce an `images` payload into the stored sub-document shape
   * ({ variantName, imageBase64, sortOrder }). Accepts either bare strings
   * (base64/URL) or already-normalized objects, dropping blank/invalid entries.
   * `sortOrder` falls back to the array position when not supplied.
   */
  private toImageDocs(images: any[]): Array<{ variantName: string; imageBase64: string; sortOrder: number }> {
    const docs: Array<{ variantName: string; imageBase64: string; sortOrder: number }> = [];
    images.forEach((img, i) => {
      if (typeof img === 'string') {
        const value = img.trim();
        if (value) docs.push({ variantName: 'Default view', imageBase64: value, sortOrder: i });
        return;
      }
      if (img && typeof img === 'object' && typeof img.imageBase64 === 'string') {
        const value = img.imageBase64.trim();
        if (!value) return;
        docs.push({
          variantName: String(img.variantName || 'Default view'),
          imageBase64: value,
          sortOrder: img.sortOrder !== undefined ? Number(img.sortOrder) : i,
        });
      }
    });
    return docs;
  }

  public async create(data: any): Promise<IProduct> {
    const productGroupCode = String(data.productGroupCode || data.productGroup || '').trim().toUpperCase();
    const name = String(data.itemName || data.name || '').trim();

    if (!productGroupCode || !name) {
      throw new AppError('productGroupCode and name are required', 400);
    }

    const image = data.imageBase64 || data.image || data.imageUrl || '';
    const variantName = String(data.variantName || data.variant || 'Default view').trim();

    const existing = await Product.findOne({ productGroupCode });

    if (existing) {
      existing.name = name;
      existing.material = String(data.material || data.category || existing.material).trim();
      existing.weight = data.weight !== undefined ? Number(data.weight) : existing.weight;
      existing.price = data.price !== undefined ? Number(data.price) : existing.price;
      existing.quantity = data.quantity !== undefined ? Number(data.quantity) : existing.quantity;
      if (data.variants !== undefined) existing.variants = data.variants;
      if (data.isFixedPrice !== undefined) existing.isFixedPrice = Boolean(data.isFixedPrice);
      if (data.makingCharge !== undefined) existing.makingCharge = data.makingCharge;
      if (data.wastage !== undefined) existing.wastage = data.wastage;
      if (data.images !== undefined && Array.isArray(data.images)) {
        // Full replace of the gallery (images[0] = primary).
        existing.images = this.toImageDocs(data.images) as any;
      } else if (image) {
        existing.images.push({
          variantName,
          imageBase64: image,
          sortOrder: Number(data.sortOrder || existing.images.length + 1),
        });
      }
      return existing.save();
    }

    const product = new Product({
      productGroupCode,
      name,
      description: data.description,
      material: String(data.material || data.category || 'Silver').trim(),
      weight: Number(data.weight ?? 0),
      price: Number(data.price || 0),
      quantity: Number(data.quantity || 1),
      originalPrice: data.originalPrice !== undefined ? Number(data.originalPrice) : undefined,
      purity: data.purity,
      isSale: Boolean(data.isSale || false),
      isFeatured: Boolean(data.isFeatured || false),
      metalValue: data.metalValue !== undefined ? Number(data.metalValue) : undefined,
      makingCharges: data.makingCharges !== undefined ? Number(data.makingCharges) : undefined,
      makingChargePercent: data.makingChargePercent !== undefined ? Number(data.makingChargePercent) : undefined,
      makingChargePerGram: data.makingChargePerGram !== undefined ? Number(data.makingChargePerGram) : undefined,
      variants: Array.isArray(data.variants) ? data.variants : [],
      isFixedPrice: Boolean(data.isFixedPrice || false),
      makingCharge: data.makingCharge !== undefined ? data.makingCharge : null,
      wastage: data.wastage !== undefined ? data.wastage : null,
      images: Array.isArray(data.images)
        ? this.toImageDocs(data.images)
        : image
          ? [{ variantName, imageBase64: image, sortOrder: Number(data.sortOrder || 1) }]
          : [],
    });

    return product.save();
  }

  /** Distinct category/subcategory combinations actually in use, for building the category tree. */
  public async getCategoryUsage(): Promise<Array<{ category: string; subcategory?: string }>> {
    const result = await Product.aggregate([
      { $match: { isActive: true, category: { $nin: [null, ''] } } },
      { $group: { _id: { category: '$category', subcategory: '$subcategory' } } },
    ]);
    return result.map((r: any) => ({ category: r._id.category, subcategory: r._id.subcategory || undefined }));
  }

  public async getTags(): Promise<string[]> {
    const result = await Product.distinct('tags', { isActive: true });
    return (result as string[]).filter(Boolean).sort();
  }

  public async findAll(filters: any = {}): Promise<IProduct[]> {
    const query: any = { isActive: true };

    if (filters.category) {
      const cats = String(filters.category).split(',').map((c: string) => c.trim()).filter(Boolean);
      query.category = cats.length === 1 ? cats[0] : { $in: cats };
    }

    if (filters.subcategory) {
      const subs = String(filters.subcategory).split(',').map((s: string) => s.trim()).filter(Boolean);
      query.subcategory = subs.length === 1 ? subs[0] : { $in: subs };
    }

    if (filters.tags) {
      const tags = String(filters.tags).split(',').map((t: string) => t.trim()).filter(Boolean);
      if (tags.length) query.tags = { $in: tags };
    }

    if (filters.metal) {
      const metals = String(filters.metal).split(',').map((m: string) => m.trim()).filter(Boolean);
      query.purity = { $in: metals.map((m: string) => new RegExp(`^${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) };
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = Number(filters.minPrice);
      if (filters.maxPrice !== undefined) query.price.$lte = Number(filters.maxPrice);
    }

    if (filters.search) {
      query.$text = { $search: String(filters.search) };
    }

    if (filters.onSale === true || filters.onSale === 'true') {
      query.$or = [{ isSale: true }, { originalPrice: { $exists: true, $ne: null } }];
    }

    if (filters.featured === true || filters.featured === 'true') {
      query.isFeatured = true;
    }

    let sortOption: any = { productGroupCode: 1 };
    if (filters.sortBy === 'price_asc') sortOption = { price: 1 };
    else if (filters.sortBy === 'price_desc') sortOption = { price: -1 };
    else if (filters.sortBy === 'newest') sortOption = { createdAt: -1 };

    const cursor = Product.find(query).sort(sortOption);

    // Optional pagination (infinite scroll). Filters/sort apply BEFORE paging, so
    // each page is a slice of the already filtered+sorted result set. When `limit`
    // is absent or invalid we return the full set (backward-compatible).
    const { skip, limit } = this.parsePagination(filters);
    if (limit !== undefined) cursor.skip(skip).limit(limit);

    return cursor.exec();
  }

  /**
   * Parse `page`/`limit` query params into a Mongo skip/limit. `page` is 1-indexed
   * (defaults to 1); `limit` is the page size, capped at MAX_PAGE_SIZE to bound the
   * payload. Returns `limit: undefined` (⇒ no pagination) when `limit` is missing or
   * not a positive integer, preserving the legacy "return everything" behaviour.
   */
  private parsePagination(filters: any): { skip: number; limit: number | undefined } {
    const MAX_PAGE_SIZE = 100;
    const rawLimit = Number(filters?.limit);
    if (!Number.isInteger(rawLimit) || rawLimit <= 0) {
      return { skip: 0, limit: undefined };
    }
    const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

    const rawPage = Number(filters?.page);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

    return { skip: (page - 1) * limit, limit };
  }

  public async findById(id: string): Promise<IProduct | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Product.findById(id).exec();
  }

  public async update(id: string, data: any): Promise<IProduct | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const updateData: any = {};
    if (data.name !== undefined || data.itemName !== undefined) updateData.name = String(data.name ?? data.itemName);
    if (data.material !== undefined || data.category !== undefined)
      updateData.material = String(data.material ?? data.category);
    if (data.weight !== undefined || data.weightGm !== undefined)
      updateData.weight = Number(data.weight ?? data.weightGm);
    if (data.price !== undefined) updateData.price = Number(data.price);
    if (data.quantity !== undefined) updateData.quantity = Number(data.quantity);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.originalPrice !== undefined) updateData.originalPrice = Number(data.originalPrice);
    if (data.purity !== undefined) updateData.purity = String(data.purity);
    if (data.isSale !== undefined) updateData.isSale = Boolean(data.isSale);
    if (data.isFeatured !== undefined) updateData.isFeatured = Boolean(data.isFeatured);
    if (data.metalValue !== undefined) updateData.metalValue = Number(data.metalValue);
    if (data.makingCharges !== undefined) updateData.makingCharges = Number(data.makingCharges);
    if (data.makingChargePercent !== undefined) updateData.makingChargePercent = Number(data.makingChargePercent);
    if (data.makingChargePerGram !== undefined) updateData.makingChargePerGram = Number(data.makingChargePerGram);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.variants !== undefined) updateData.variants = data.variants;
    // Full replace of the gallery. An empty array clears all images.
    if (data.images !== undefined) updateData.images = this.toImageDocs(Array.isArray(data.images) ? data.images : []);
    if (data.isFixedPrice !== undefined) updateData.isFixedPrice = Boolean(data.isFixedPrice);
    if (data.makingCharge !== undefined) updateData.makingCharge = data.makingCharge;
    if (data.wastage !== undefined) updateData.wastage = data.wastage;

    return Product.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  public async delete(id: string): Promise<IProduct | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Product.findByIdAndDelete(id).exec();
  }

  public async findFeatured(): Promise<IProduct[]> {
    return Product.find({ isActive: true }).sort({ createdAt: -1 }).limit(10).exec();
  }

  public async count(): Promise<number> {
    return Product.countDocuments({ isActive: true });
  }
}
