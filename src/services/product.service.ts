import { ProductRepository } from '../repositories/product.repository';
import { UserRepository } from '../repositories/user.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PricingService } from './pricing.service';
import { AppError } from '../utils/appError';
import { sendNewProductPromotion } from '../utils/emailNotifications';
import Logger from '../utils/logger';
import { config } from '../config';

export class ProductService {
  private productRepository: ProductRepository;
  private userRepository: UserRepository;
  private inventoryRepository: InventoryRepository;
  private pricingService: PricingService;

  constructor() {
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
    this.inventoryRepository = new InventoryRepository();
    this.pricingService = new PricingService();
  }

  public async createProduct(data: any) {
    const payload = this.validateCreatePayload(data);
    try {
      const product = await this.productRepository.create(payload);

      // Seed the inventory stock document from the product's listed quantity so
      // Inventory.currentStock is the single source of truth from the start.
      try {
        await this.inventoryRepository.ensureStock(product._id.toString(), Number(product.quantity) || 0);
      } catch (stockError) {
        Logger.error(`Inventory init failed for ${product._id}: ${stockError instanceof Error ? stockError.message : String(stockError)}`);
      }

      this.dispatchPromotionalEmails(product);

      return product;
    } catch (error) {
      throw this.mapPersistenceError(error);
    }
  }

  private dispatchPromotionalEmails(product: { name: string; material: string; price: number }): void {
    if (!config.brevoSmtpUser || !config.brevoSmtpPassword) {
      return;
    }

    void (async () => {
      try {
        const regularUsers = await this.userRepository.findRegularCustomers();
        const recipientEmails = regularUsers
          .map((u) => u.email)
          .filter((email) => typeof email === 'string' && email.length > 0);

        await sendNewProductPromotion({
          productName: product.name,
          category: product.material,
          price: product.price,
          recipients: recipientEmails,
        });
      } catch (emailError) {
        Logger.error(`Promotional email dispatch failed: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
      }
    })();
  }

  public async getProducts(filters: any) {
    const products = await this.productRepository.findAll(filters);
    const enriched = await this.pricingService.enrichManyForDisplay(products);
    return await this.attachStock(enriched);
  }

  public async getCategories() {
    return await this.productRepository.getCategories();
  }

  public async getProductById(id: string) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new AppError('Product not found', 404);
    const enriched = await this.pricingService.enrichForDisplay(product);
    return (await this.attachStock([enriched]))[0];
  }

  /**
   * Attach live stock from the Inventory collection (source of truth). Falls
   * back to the product's listed quantity when no inventory doc exists yet.
   */
  private async attachStock(items: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    const ids = items.map((i) => String((i as any)._id)).filter(Boolean);
    const stockMap = await this.inventoryRepository.getStockMap(ids);
    return items.map((i) => {
      const id = String((i as any)._id);
      const stock = stockMap[id] !== undefined ? stockMap[id] : Number((i as any).quantity) || 0;
      return { ...i, stockAvailable: stock, inStock: stock > 0 };
    });
  }

  public async updateProduct(id: string, data: any) {
    const payload = this.validateUpdatePayload(data);
    try {
      const product = await this.productRepository.update(id, payload);
      if (!product) throw new AppError('Product not found', 404);
      return product;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw this.mapPersistenceError(error);
    }
  }

  public async deleteProduct(id: string) {
    const product = await this.productRepository.delete(id);
    if (!product) throw new AppError('Product not found', 404);
    return product;
  }

  public async getFeaturedProducts() {
    const products = await this.productRepository.findFeatured();
    const enriched = await this.pricingService.enrichManyForDisplay(products);
    return await this.attachStock(enriched);
  }

  private validateCreatePayload(data: any) {
    const payload = data || {};

    const name = String(payload.itemName || payload.name || '').trim();
    if (!name) {
      throw new AppError('name is required', 400);
    }

    // Auto-generate productGroupCode from name + timestamp when not provided by frontend
    const rawCode = String(payload.productGroupCode || payload.productGroup || '').trim();
    const productGroupCode = rawCode
      ? rawCode.toUpperCase()
      : `${name.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 20)}_${Date.now()}`;

    const material = String(payload.material || payload.category || '').trim();
    if (!material) {
      throw new AppError('category is required', 400);
    }

    // Parse weight whether supplied as number (10), numeric string ("10"), or string with unit ("2g")
    const rawWeight = payload.weightGm ?? payload.weight;
    const weight = typeof rawWeight === 'string'
      ? Number(rawWeight.replace(/[^\d.]/g, ''))
      : Number(rawWeight);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new AppError('weight must be a positive number', 400);
    }

    const price = Number(payload.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new AppError('price must be a positive number', 400);
    }

    const quantity = payload.quantity === undefined ? 1 : Number(payload.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new AppError('quantity must be a whole number greater than or equal to 0', 400);
    }

    const image = payload.imageBase64 || payload.image || payload.imageUrl;
    if (image !== undefined && typeof image !== 'string') {
      throw new AppError('image must be a string (base64 or URL)', 400);
    }

    // isActive can come from field `isActive` (boolean) or `inStock` (boolean)
    const isActive: boolean =
      payload.isActive !== undefined ? Boolean(payload.isActive) : (payload.inStock !== undefined ? Boolean(payload.inStock) : true);

    const result: Record<string, unknown> = {
      ...payload,
      productGroupCode,
      name,
      material,
      weight,
      price,
      quantity,
      isActive,
    };

    if (payload.originalPrice !== undefined) result.originalPrice = Number(payload.originalPrice);
    if (payload.purity !== undefined) result.purity = String(payload.purity);

    if (payload.makingChargePercent !== undefined) {
      const pct = Number(payload.makingChargePercent);
      if (!Number.isFinite(pct) || pct < 0) {
        throw new AppError('makingChargePercent must be a non-negative number', 400);
      }
      result.makingChargePercent = pct;
    }

    if (payload.makingChargePerGram !== undefined) {
      const perGram = Number(payload.makingChargePerGram);
      if (!Number.isFinite(perGram) || perGram < 0) {
        throw new AppError('makingChargePerGram must be a non-negative number', 400);
      }
      result.makingChargePerGram = perGram;
    }

    return result;
  }

  private validateUpdatePayload(data: any) {
    const payload = data || {};
    const update: Record<string, unknown> = {};

    if (payload.name !== undefined || payload.itemName !== undefined) {
      const name = String(payload.name ?? payload.itemName).trim();
      if (!name) throw new AppError('name must be a non-empty string', 400);
      update.name = name;
    }

    if (payload.material !== undefined || payload.category !== undefined) {
      const material = String(payload.material ?? payload.category).trim();
      if (!material) throw new AppError('category must be a non-empty string', 400);
      update.material = material;
    }

    if (payload.weight !== undefined || payload.weightGm !== undefined) {
      const rawWeight = payload.weightGm ?? payload.weight;
      const weight = typeof rawWeight === 'string'
        ? Number(rawWeight.replace(/[^\d.]/g, ''))
        : Number(rawWeight);
      if (!Number.isFinite(weight) || weight <= 0) {
        throw new AppError('weight must be a positive number', 400);
      }
      update.weight = weight;
    }

    if (payload.price !== undefined) {
      const price = Number(payload.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw new AppError('price must be a positive number', 400);
      }
      update.price = price;
    }

    if (payload.quantity !== undefined) {
      const quantity = Number(payload.quantity);
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new AppError('quantity must be a whole number greater than or equal to 0', 400);
      }
      update.quantity = quantity;
    }

    if (payload.description !== undefined) {
      update.description = String(payload.description);
    }

    if (payload.originalPrice !== undefined) {
      update.originalPrice = Number(payload.originalPrice);
    }

    if (payload.purity !== undefined) {
      update.purity = String(payload.purity);
    }

    if (payload.makingChargePercent !== undefined) {
      const pct = Number(payload.makingChargePercent);
      if (!Number.isFinite(pct) || pct < 0) {
        throw new AppError('makingChargePercent must be a non-negative number', 400);
      }
      update.makingChargePercent = pct;
    }

    if (payload.makingChargePerGram !== undefined) {
      const perGram = Number(payload.makingChargePerGram);
      if (!Number.isFinite(perGram) || perGram < 0) {
        throw new AppError('makingChargePerGram must be a non-negative number', 400);
      }
      update.makingChargePerGram = perGram;
    }

    if (payload.isActive !== undefined || payload.inStock !== undefined) {
      const activeVal = payload.isActive !== undefined ? payload.isActive : payload.inStock;
      if (typeof activeVal !== 'boolean') {
        throw new AppError('isActive must be a boolean', 400);
      }
      update.isActive = activeVal;
    }

    if (Object.keys(update).length === 0) {
      throw new AppError('No valid fields provided for update', 400);
    }

    return update;
  }

  private mapPersistenceError(error: unknown): AppError {
    const err = error as { code?: number; name?: string; message?: string; errors?: Record<string, { message?: string }> };

    if (err.code === 11000) {
      return new AppError('A product with this productGroupCode already exists', 409);
    }

    if (err.name === 'ValidationError' && err.errors) {
      const message = Object.values(err.errors)
        .map((e) => e.message)
        .filter(Boolean)
        .join(', ');
      return new AppError(message || 'Product validation failed', 400);
    }

    return new AppError(err.message || 'Failed to process product request', 400);
  }
}
