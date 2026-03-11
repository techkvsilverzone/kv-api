import mongoose from 'mongoose';
import { Wishlist } from '../models/wishlist.model';

export class WishlistRepository {
  public async findByUserId(userId: string): Promise<any> {
    const wishlist = await Wishlist.findOne({ userId: new mongoose.Types.ObjectId(userId) })
      .populate('items.productId')
      .exec();

    if (!wishlist) return { items: [] };

    const items = wishlist.items
      .filter((i) => i.productId)
      .map((i) => ({ product: i.productId }));

    return { items };
  }

  public async addItem(userId: string, productId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return this.findByUserId(userId);
    }

    const pid = new mongoose.Types.ObjectId(productId);

    await Wishlist.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $addToSet: { items: { productId: pid } } },
      { upsert: true, new: true },
    ).exec();

    return this.findByUserId(userId);
  }

  public async removeItem(userId: string, productId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return this.findByUserId(userId);
    }

    await Wishlist.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { items: { productId: new mongoose.Types.ObjectId(productId) } } },
    ).exec();

    return this.findByUserId(userId);
  }
}
