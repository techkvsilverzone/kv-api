import { Category } from '../models/category.model';

export class CategoryRepository {
  public async findAllNames(): Promise<string[]> {
    const categories = await Category.find().sort({ name: 1 }).exec();
    return categories.map((c) => c.name);
  }

  /** Idempotent — creating a category that already exists is a no-op, not an error. */
  public async create(name: string): Promise<void> {
    await Category.findOneAndUpdate(
      { name },
      { $setOnInsert: { name } },
      { upsert: true },
    ).exec();
  }

  public async delete(name: string): Promise<void> {
    await Category.deleteOne({ name }).exec();
  }
}
