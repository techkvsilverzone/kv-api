import mongoose from 'mongoose';
import { Product, IProduct } from '../models/product.model';

export class ProductRepository {
  public async create(data: any): Promise<IProduct> {
    const productGroupCode = String(data.productGroupCode || data.productGroup || '').trim().toUpperCase();
    const name = String(data.itemName || data.name || '').trim();

    if (!productGroupCode || !name) {
      throw new Error('productGroupCode and name are required');
    }

    const image = data.imageBase64 || data.image || data.imageUrl || '';
    const variantName = String(data.variantName || data.variant || 'Default view').trim();

    const existing = await Product.findOne({ productGroupCode });

    if (existing) {
      existing.name = name;
      existing.material = String(data.material || data.category || existing.material).trim();
      existing.weight = data.weightGm !== undefined ? Number(data.weightGm) : existing.weight;
      existing.price = data.price !== undefined ? Number(data.price) : existing.price;
      existing.quantity = data.quantity !== undefined ? Number(data.quantity) : existing.quantity;
      if (image) {
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
      weight: Number(data.weightGm ?? data.weight ?? 0),
      price: Number(data.price || 0),
      quantity: Number(data.quantity || 1),
      images: image
        ? [{ variantName, imageBase64: image, sortOrder: Number(data.sortOrder || 1) }]
        : [],
    });

    return product.save();
  }

  public async getCategories(): Promise<string[]> {
    const result = await Product.distinct('material', { isActive: true });
    return result.sort();
  }

  public async findAll(filters: any = {}): Promise<IProduct[]> {
    const query: any = { isActive: true };

    if (filters.category) {
      query.material = filters.category;
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = Number(filters.minPrice);
      if (filters.maxPrice !== undefined) query.price.$lte = Number(filters.maxPrice);
    }

    if (filters.search) {
      query.$text = { $search: String(filters.search) };
    }

    let sortOption: any = { productGroupCode: 1 };
    if (filters.sortBy === 'price_asc') sortOption = { price: 1 };
    else if (filters.sortBy === 'price_desc') sortOption = { price: -1 };
    else if (filters.sortBy === 'newest') sortOption = { createdAt: -1 };

    return Product.find(query).sort(sortOption).exec();
  }

  public async findById(id: string): Promise<IProduct | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Product.findById(id).exec();
  }

  public async update(id: string, data: any): Promise<IProduct | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const updateData: any = {};
    if (data.name || data.itemName) updateData.name = data.name || data.itemName;
    if (data.material || data.category) updateData.material = data.material || data.category;
    if (data.weight !== undefined || data.weightGm !== undefined)
      updateData.weight = data.weightGm ?? data.weight;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

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
