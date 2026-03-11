import mongoose from 'mongoose';
import { Cart, ICart } from '../models/cart.model';
import { Product } from '../models/product.model';

export class CartRepository {
  public async findByUserId(userId: string): Promise<ICart | null> {
    return Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) })
      .populate('items.productId')
      .exec();
  }

  public async update(userId: string, items: any[]): Promise<ICart | null> {
    const validItems = [];

    for (const item of items) {
      const rawId = item?.product?._id ?? item?.product?.id ?? item?.productId ?? item?.product;
      if (!mongoose.Types.ObjectId.isValid(rawId)) continue;

      const product = await Product.findById(rawId);
      if (!product) continue;

      const quantity = Number(item?.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      validItems.push({
        productId: product._id,
        productGroupCode: product.productGroupCode,
        productName: product.name,
        quantity,
        weight: product.weight,
        unitPrice: product.price,
      });
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: { items: validItems } },
      { upsert: true, new: true },
    ).exec();

    return cart;
  }

  public async removeItem(userId: string, productId: string): Promise<ICart | null> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return this.findByUserId(userId);
    }

    return Cart.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { items: { productId: new mongoose.Types.ObjectId(productId) } } },
      { new: true },
    ).exec();
  }
}
