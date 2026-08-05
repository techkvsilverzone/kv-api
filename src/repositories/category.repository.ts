import { Category } from '../models/category.model';

export interface CategoryRecord {
  name: string;
  parent: string | null;
}

export class CategoryRepository {
  public async findAll(): Promise<CategoryRecord[]> {
    const categories = await Category.find().sort({ parent: 1, name: 1 }).exec();
    return categories.map((c) => ({ name: c.name, parent: c.parent }));
  }

  /** Idempotent — creating a category (or subcategory, when `parent` is set) that already exists is a no-op. */
  public async create(name: string, parent: string | null = null): Promise<void> {
    await Category.findOneAndUpdate(
      { name, parent },
      { $setOnInsert: { name, parent } },
      { upsert: true },
    ).exec();
  }

  public async delete(name: string, parent: string | null = null): Promise<void> {
    await Category.deleteOne({ name, parent }).exec();
  }

  /** Removes every subcategory registered under `parent` (used when the parent category is deleted). */
  public async deleteChildren(parent: string): Promise<void> {
    await Category.deleteMany({ parent }).exec();
  }
}
