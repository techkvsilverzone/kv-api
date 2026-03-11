import { ProductRepository } from '../repositories/product.repository';
import { AppError } from '../utils/appError';

export class ProductService {
  private productRepository: ProductRepository;

  constructor() {
    this.productRepository = new ProductRepository();
  }

  public async createProduct(data: any) {
    return await this.productRepository.create(data);
  }

  public async getProducts(filters: any) {
    return await this.productRepository.findAll(filters);
  }

  public async getCategories() {
    return await this.productRepository.getCategories();
  }

  public async getProductById(id: string) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new AppError('Product not found', 404);
    return product;
  }

  public async updateProduct(id: string, data: any) {
    const product = await this.productRepository.update(id, data);
    if (!product) throw new AppError('Product not found', 404);
    return product;
  }

  public async deleteProduct(id: string) {
    const product = await this.productRepository.delete(id);
    if (!product) throw new AppError('Product not found', 404);
    return product;
  }

  public async getFeaturedProducts() {
    return await this.productRepository.findFeatured();
  }
}
