import { ProductRepository } from '../repositories/product.repository';
import { PincodeRateRepository } from '../repositories/pincodeRate.repository';
import { GiftVoucherRepository } from '../repositories/giftVoucher.repository';
import { PricingConfigRepository } from '../repositories/pricingConfig.repository';
import { MetalRateService } from './metalrate.service';
import { CouponService } from './coupon.service';
import { IProduct } from '../models/product.model';
import { AppError } from '../utils/appError';
import Logger from '../utils/logger';

export interface UnitPriceBreakdown {
  unitPrice: number;
  metalValue: number;
  makingCharge: number;
  ratePerGram: number | null;
  purityFraction: number;
  basis: 'live' | 'static';
}

export interface CheckoutItemInput {
  product?: string;
  productId?: string;
  giftVoucherId?: string;
  quantity?: number;
  isGiftVoucher?: boolean;
}

export interface PricedLineItem {
  product: string;
  productGroupCode: string;
  name: string;
  weight: number;
  quantity: number;
  price: number; // authoritative unit price
  totalPrice: number;
  isGiftVoucher: boolean;
  stockAvailable: number | null; // null for gift vouchers (no stock tracking)
  basis: 'live' | 'static' | 'voucher';
}

export interface CheckoutBreakdown {
  items: PricedLineItem[];
  subtotal: number;
  taxableSubtotal: number;
  taxAmount: number;
  discount: number;
  couponCode: string | null;
  deliveryFee: number;
  grandTotal: number;
  amountInPaise: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Resolve a product's `purity` field (e.g. "925", "999", "92.5", "Silver 925")
 * into a fraction of pure metal in [0, 1]. Silver jewelry defaults to 0.925
 * when purity is absent; non-silver materials default to 1.
 */
export const resolvePurityFraction = (purity: string | undefined, material: string | undefined): number => {
  const digits = String(purity ?? '').match(/[\d.]+/);
  if (digits) {
    const value = Number(digits[0]);
    if (Number.isFinite(value) && value > 0) {
      let fraction = value;
      if (value > 1) fraction = value >= 100 ? value / 1000 : value / 100;
      return Math.min(Math.max(fraction, 0), 1);
    }
  }
  return /silver/i.test(String(material ?? '')) ? 0.925 : 1;
};

export class PricingService {
  private productRepository: ProductRepository;
  private pincodeRateRepository: PincodeRateRepository;
  private giftVoucherRepository: GiftVoucherRepository;
  private pricingConfigRepository: PricingConfigRepository;
  private metalRateService: MetalRateService;
  private couponService: CouponService;

  constructor() {
    this.productRepository = new ProductRepository();
    this.pincodeRateRepository = new PincodeRateRepository();
    this.giftVoucherRepository = new GiftVoucherRepository();
    this.pricingConfigRepository = new PricingConfigRepository();
    this.metalRateService = new MetalRateService();
    this.couponService = new CouponService();
  }

  /**
   * Current SILVER rate per gram, preferring today's rate and falling back to
   * the most recent recorded rate. Returns null when no rate has ever been set
   * (callers then fall back to the product's static listed price).
   */
  public async getCurrentSilverRatePerGram(): Promise<number | null> {
    const todays = await this.metalRateService.getTodayRates('SILVER');
    if (todays.length > 0 && todays[0].ratePerGram > 0) {
      return todays[0].ratePerGram;
    }
    const all = await this.metalRateService.getAllRates('SILVER');
    const latest = all
      .filter((r) => r.ratePerGram > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return latest ? latest.ratePerGram : null;
  }

  /**
   * Compute the authoritative unit price of a product.
   * Live basis = weight(g) x silver rate/g x purity + making charge.
   * Falls back to the static listed price when the rate, weight, or making-charge
   * inputs are unavailable.
   */
  public computeUnitPrice(product: IProduct, silverRatePerGram: number | null): UnitPriceBreakdown {
    const weight = Number(product.weight) || 0;
    const purityFraction = resolvePurityFraction(product.purity, product.material);
    const hasMakingInput =
      product.makingChargePerGram !== undefined ||
      product.makingChargePercent !== undefined ||
      product.makingCharges !== undefined;

    const canComputeLive =
      silverRatePerGram !== null && silverRatePerGram > 0 && weight > 0 && hasMakingInput;

    if (!canComputeLive) {
      return {
        unitPrice: round2(Number(product.price) || 0),
        metalValue: round2((Number(product.metalValue) || 0)),
        makingCharge: round2(Number(product.makingCharges) || 0),
        ratePerGram: silverRatePerGram,
        purityFraction,
        basis: 'static',
      };
    }

    const metalValue = weight * (silverRatePerGram as number) * purityFraction;

    let makingCharge = 0;
    if (product.makingChargePerGram !== undefined) {
      makingCharge = (Number(product.makingChargePerGram) || 0) * weight;
    } else if (product.makingChargePercent !== undefined) {
      makingCharge = metalValue * ((Number(product.makingChargePercent) || 0) / 100);
    } else {
      makingCharge = Number(product.makingCharges) || 0;
    }

    return {
      unitPrice: round2(metalValue + makingCharge),
      metalValue: round2(metalValue),
      makingCharge: round2(makingCharge),
      ratePerGram: silverRatePerGram,
      purityFraction,
      basis: 'live',
    };
  }

  /**
   * Enrich a product document for read responses (B3): exposes the live price
   * and the inputs the storefront needs to display the breakdown.
   */
  public async enrichForDisplay(product: IProduct): Promise<Record<string, unknown>> {
    const ratePerGram = await this.getCurrentSilverRatePerGram();
    return this.enrichWithRate(product, ratePerGram);
  }

  public async enrichManyForDisplay(products: IProduct[]): Promise<Record<string, unknown>[]> {
    const ratePerGram = await this.getCurrentSilverRatePerGram();
    return products.map((p) => this.enrichWithRate(p, ratePerGram));
  }

  private enrichWithRate(product: IProduct, ratePerGram: number | null): Record<string, unknown> {
    const breakdown = this.computeUnitPrice(product, ratePerGram);
    const base = typeof product.toObject === 'function' ? product.toObject() : product;
    return {
      ...base,
      price: breakdown.unitPrice,
      listedPrice: Number(product.price) || 0,
      weightInGrams: Number(product.weight) || 0,
      purity: product.purity,
      makingChargePercent: product.makingChargePercent,
      makingChargePerGram: product.makingChargePerGram,
      pricing: {
        basis: breakdown.basis,
        metalValue: breakdown.metalValue,
        makingCharge: breakdown.makingCharge,
        ratePerGram: breakdown.ratePerGram,
        purityFraction: breakdown.purityFraction,
        currency: 'INR',
      },
    };
  }

  /**
   * Authoritative checkout computation (B2). Prices every line item from the DB,
   * applies server-validated coupon + GST + delivery, and returns the amount to
   * charge. Never trusts any client-supplied price/total.
   */
  public async computeCheckout(input: {
    items: CheckoutItemInput[];
    couponCode?: string | null;
    pincode?: string | null;
  }): Promise<CheckoutBreakdown> {
    const rawItems = Array.isArray(input.items) ? input.items : [];
    if (rawItems.length === 0) {
      throw new AppError('Cannot checkout with an empty cart', 400);
    }

    const ratePerGram = await this.getCurrentSilverRatePerGram();
    const items: PricedLineItem[] = [];

    for (const raw of rawItems) {
      const quantity = Number(raw.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new AppError('Each item quantity must be a positive whole number', 400);
      }

      const voucherId = raw.giftVoucherId || (raw.isGiftVoucher ? raw.product || raw.productId : undefined);
      if (raw.isGiftVoucher || raw.giftVoucherId) {
        const voucher = voucherId ? await this.giftVoucherRepository.findById(String(voucherId)) : null;
        if (!voucher || !voucher.isActive) {
          throw new AppError('Gift voucher is invalid or no longer available', 400);
        }
        const unitPrice = round2(Number(voucher.amount));
        items.push({
          product: voucher._id.toString(),
          productGroupCode: 'GIFT-VOUCHER',
          name: voucher.label,
          weight: 0,
          quantity,
          price: unitPrice,
          totalPrice: round2(unitPrice * quantity),
          isGiftVoucher: true,
          stockAvailable: null,
          basis: 'voucher',
        });
        continue;
      }

      const productId = raw.product || raw.productId;
      const product = productId ? await this.productRepository.findById(String(productId)) : null;
      if (!product) {
        throw new AppError(`Product not found: ${String(productId)}`, 404);
      }
      if (!product.isActive) {
        throw new AppError(`Product is no longer available: ${product.name}`, 400);
      }

      const breakdown = this.computeUnitPrice(product, ratePerGram);
      if (breakdown.basis === 'static' && ratePerGram === null) {
        Logger.warn(`Pricing fell back to static price for ${product.name} — no silver rate set`);
      }

      items.push({
        product: product._id.toString(),
        productGroupCode: product.productGroupCode,
        name: product.name,
        weight: Number(product.weight) || 0,
        quantity,
        price: breakdown.unitPrice,
        totalPrice: round2(breakdown.unitPrice * quantity),
        isGiftVoucher: false,
        stockAvailable: Number(product.quantity) || 0,
        basis: breakdown.basis,
      });
    }

    const subtotal = round2(items.reduce((sum, i) => sum + i.totalPrice, 0));
    const taxableSubtotal = round2(
      items.filter((i) => !i.isGiftVoucher).reduce((sum, i) => sum + i.totalPrice, 0),
    );
    // Admin-configurable GST rate (defaults to 3%).
    const gstPercent = await this.pricingConfigRepository.getGstPercent();
    const taxAmount = round2(taxableSubtotal * (gstPercent / 100));

    let discount = 0;
    let couponCode: string | null = null;
    if (input.couponCode && String(input.couponCode).trim()) {
      const result = await this.couponService.applyCoupon(String(input.couponCode), subtotal);
      discount = round2(Math.min(result.discount, subtotal));
      couponCode = String(input.couponCode).trim().toUpperCase();
    }

    let deliveryFee = 0;
    if (input.pincode) {
      const pincodeRate = await this.pincodeRateRepository.findByPincode(String(input.pincode));
      if (pincodeRate) deliveryFee = Number(pincodeRate.rate) || 0;
    }

    const grandTotal = Math.max(0, round2(subtotal + taxAmount - discount + deliveryFee));

    return {
      items,
      subtotal,
      taxableSubtotal,
      taxAmount,
      discount,
      couponCode,
      deliveryFee,
      grandTotal,
      amountInPaise: Math.round(grandTotal * 100),
    };
  }
}
