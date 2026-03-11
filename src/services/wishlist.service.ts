import { WishlistRepository } from '../repositories/wishlist.repository';

export class WishlistService {
  private wishlistRepository: WishlistRepository;

  constructor() {
    this.wishlistRepository = new WishlistRepository();
  }

  public async getWishlist(userId: string) {
    return await this.wishlistRepository.findByUserId(userId);
  }

  public async addItem(userId: string, productId: string) {
    return await this.wishlistRepository.addItem(userId, productId);
  }

  public async removeItem(userId: string, productId: string) {
    return await this.wishlistRepository.removeItem(userId, productId);
  }
}
