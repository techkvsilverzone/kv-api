import { CartRepository } from '../repositories/cart.repository';

export class CartService {
  private cartRepository: CartRepository;

  constructor() {
    this.cartRepository = new CartRepository();
  }

  public async getCart(userId: string) {
    return await this.cartRepository.findByUserId(userId);
  }

  public async updateCart(userId: string, productId: string, quantity: number) {
    const cart = await this.cartRepository.findByUserId(userId);
    let items = cart ? [...cart.items] : [];

    const getProductId = (item: any): string => {
      const value = item?.product?._id ?? item?.product?.id ?? item?.product?.imageId ?? item?.product;
      return value !== undefined && value !== null ? String(value) : '';
    };
    
    const existingIndex = items.findIndex((item) => getProductId(item) === String(productId));
    if (existingIndex > -1) {
      if (quantity <= 0) {
        items.splice(existingIndex, 1);
      } else {
        items[existingIndex].quantity = quantity;
      }
    } else if (quantity > 0) {
      items.push({ productId: String(productId), quantity } as any);
    }

    return await this.cartRepository.update(userId, items);
  }

  public async removeItem(userId: string, productId: string) {
    return await this.cartRepository.removeItem(userId, productId);
  }
}
