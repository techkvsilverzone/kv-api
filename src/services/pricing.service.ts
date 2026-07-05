import { ProductRepository } from '../repositories/product.repository';
import { GiftVoucherRepository } from '../repositories/giftVoucher.repository';
import { PricingConfigRepository } from '../repositories/pricingConfig.repository';
import {
  DeliveryConfigRepository,
  DeliveryConfigValues,
} from '../repositories/deliveryConfig.repository';
import { MetalRateService } from './metalrate.service';
import { CouponService } from './coupon.service';
import { IProduct, IProductCharge } from '../models/product.model';
import { AppError } from '../utils/appError';
import Logger from '../utils/logger';

export interface UnitPriceBreakdown {
  unitPrice: number;
  metalValue: number;
  makingCharge: number;
  wastage: number;
  ratePerGram: number | null;
  purityFraction: number;
  basis: 'live' | 'static' | 'fixed';
}

export interface CheckoutAddress {
  city?: string;
  state?: string;
  pincode?: string;
}

export type DeliveryZone = keyof DeliveryConfigValues;

export interface CheckoutItemInput {
  product?: string;
  productId?: string;
  giftVoucherId?: string;
  quantity?: number;
  isGiftVoucher?: boolean;
  /** Selected size-variant weight (free-text, e.g. "12.5" or "12.5 g"). Overrides product weight. */
  variantWeight?: string | number;
  weight?: string | number;
}

export interface PricedLineItem {
  product: string;
  productGroupCode: string;
  name: string;
  weight: number;
  quantity: number;
  price: number; // authoritative unit price (pre-GST)
  totalPrice: number;
  metalValue: number; // per-unit metal value
  makingCharge: number; // per-unit making charge (rupees)
  wastage: number; // per-unit wastage (rupees)
  isGiftVoucher: boolean;
  stockAvailable: number | null; // null for gift vouchers (no stock tracking)
  basis: 'live' | 'static' | 'fixed' | 'voucher';
}

export interface CheckoutBreakdown {
  items: PricedLineItem[];
  subtotal: number; // pre-GST, all items
  taxableSubtotal: number; // pre-GST, excludes gift vouchers
  discount: number;
  couponCode: string | null;
  gstPercent: number;
  taxAmount: number; // GST on the discounted taxable subtotal
  deliveryZone: DeliveryZone | null;
  deliveryFee: number;
  grandTotal: number;
  amountInPaise: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Parse a numeric weight from a free-text variant weight (e.g. "12.5 g" -> 12.5). */
const parseWeight = (raw: string | number | undefined): number | undefined => {
  if (raw === undefined || raw === null) return undefined;
  const match = String(raw).match(/[\d.]+/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * Resolve a `{ type, value }` charge against the metal value: a percentage is
 * taken against the metal value, an amount is a flat rupee figure.
 */
const resolveChargeAmount = (charge: IProductCharge | null | undefined, metalValue: number): number => {
  if (!charge) return 0;
  const value = Number(charge.value) || 0;
  if (value <= 0) return 0;
  return charge.type === 'amount' ? value : metalValue * (value / 100);
};

/**
 * Resolve the delivery zone from the shipping address, mirroring the frontend
 * `resolveDeliveryZone`: Chennai city -> chennai; else Tamil Nadu -> otherDistrict;
 * everything else -> otherState. Returns null when no address is supplied.
 */
export const resolveDeliveryZone = (address?: CheckoutAddress | null): DeliveryZone | null => {
  if (!address) return null;
  const city = String(address.city ?? '').trim().toLowerCase();
  const state = String(address.state ?? '').trim().toLowerCase();
  if (!city && !state) return null;
  if (city === 'chennai') return 'chennai';
  if (state === 'tamil nadu' || state === 'tamilnadu') return 'otherDistrict';
  return 'otherState';
};

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
  private giftVoucherRepository: GiftVoucherRepository;
  private pricingConfigRepository: PricingConfigRepository;
  private deliveryConfigRepository: DeliveryConfigRepository;
  private metalRateService: MetalRateService;
  private couponService: CouponService;

  constructor() {
    this.productRepository = new ProductRepository();
    this.giftVoucherRepository = new GiftVoucherRepository();
    this.pricingConfigRepository = new PricingConfigRepository();
    this.deliveryConfigRepository = new DeliveryConfigRepository();
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
   * Compute the authoritative pre-GST unit price of a product.
   *
   * - Fixed-price products (`isFixedPrice`): the listed `price` IS the pre-GST
   *   price — no metal-value calc, no making/wastage.
   * - Dynamic products: metalValue = weight(g) x silver rate/g x purity, then
   *   + making charge + wastage. Making/wastage prefer the admin-config
   *   `{ type, value }` objects (percentage taken against metal value, amount =
   *   flat rupees), falling back to the legacy making-charge fields.
   * - Falls back to the static listed `price` when the rate or weight is
   *   unavailable, or when a dynamic product has no charge input at all.
   *
   * `weightOverride` supplies a selected size-variant weight for the line.
   */
  public computeUnitPrice(
    product: IProduct,
    silverRatePerGram: number | null,
    weightOverride?: number,
  ): UnitPriceBreakdown {
    const weight = weightOverride && weightOverride > 0 ? weightOverride : Number(product.weight) || 0;
    const purityFraction = resolvePurityFraction(product.purity, product.material);

    // Fixed-price products skip the metal-value calc entirely.
    if (product.isFixedPrice) {
      const price = round2(Number(product.price) || 0);
      return {
        unitPrice: price,
        metalValue: price,
        makingCharge: 0,
        wastage: 0,
        ratePerGram: silverRatePerGram,
        purityFraction,
        basis: 'fixed',
      };
    }

    const hasNewCharge = !!product.makingCharge || !!product.wastage;
    const hasLegacyMaking =
      product.makingChargePerGram !== undefined ||
      product.makingChargePercent !== undefined ||
      product.makingCharges !== undefined;

    const canComputeLive =
      silverRatePerGram !== null &&
      silverRatePerGram > 0 &&
      weight > 0 &&
      (hasNewCharge || hasLegacyMaking);

    if (!canComputeLive) {
      return {
        unitPrice: round2(Number(product.price) || 0),
        metalValue: round2(Number(product.metalValue) || 0),
        makingCharge: round2(Number(product.makingCharges) || 0),
        wastage: 0,
        ratePerGram: silverRatePerGram,
        purityFraction,
        basis: 'static',
      };
    }

    const metalValue = weight * (silverRatePerGram as number) * purityFraction;

    let makingCharge = 0;
    if (product.makingCharge) {
      makingCharge = resolveChargeAmount(product.makingCharge, metalValue);
    } else if (product.makingChargePerGram !== undefined) {
      makingCharge = (Number(product.makingChargePerGram) || 0) * weight;
    } else if (product.makingChargePercent !== undefined) {
      makingCharge = metalValue * ((Number(product.makingChargePercent) || 0) / 100);
    } else {
      makingCharge = Number(product.makingCharges) || 0;
    }

    const wastage = resolveChargeAmount(product.wastage, metalValue);

    return {
      unitPrice: round2(metalValue + makingCharge + wastage),
      metalValue: round2(metalValue),
      makingCharge: round2(makingCharge),
      wastage: round2(wastage),
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
      isFixedPrice: product.isFixedPrice ?? false,
      pricing: {
        basis: breakdown.basis,
        metalValue: breakdown.metalValue,
        makingCharge: breakdown.makingCharge,
        wastage: breakdown.wastage,
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
    address?: CheckoutAddress | null;
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
          metalValue: 0,
          makingCharge: 0,
          wastage: 0,
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

      // Honour a selected size-variant weight carried on the line item.
      const weightOverride = parseWeight(raw.variantWeight ?? raw.weight);
      const breakdown = this.computeUnitPrice(product, ratePerGram, weightOverride);
      if (breakdown.basis === 'static' && ratePerGram === null) {
        Logger.warn(`Pricing fell back to static price for ${product.name} — no silver rate set`);
      }

      items.push({
        product: product._id.toString(),
        productGroupCode: product.productGroupCode,
        name: product.name,
        weight: weightOverride ?? (Number(product.weight) || 0),
        quantity,
        price: breakdown.unitPrice,
        totalPrice: round2(breakdown.unitPrice * quantity),
        metalValue: breakdown.metalValue,
        makingCharge: breakdown.makingCharge,
        wastage: breakdown.wastage,
        isGiftVoucher: false,
        stockAvailable: Number(product.quantity) || 0,
        basis: breakdown.basis,
      });
    }

    const subtotal = round2(items.reduce((sum, i) => sum + i.totalPrice, 0));
    const taxableSubtotal = round2(
      items.filter((i) => !i.isGiftVoucher).reduce((sum, i) => sum + i.totalPrice, 0),
    );

    // 1. Coupon discount is applied to the subtotal BEFORE GST.
    let discount = 0;
    let couponCode: string | null = null;
    if (input.couponCode && String(input.couponCode).trim()) {
      const result = await this.couponService.applyCoupon(String(input.couponCode), subtotal);
      discount = round2(Math.min(result.discount, subtotal));
      couponCode = String(input.couponCode).trim().toUpperCase();
    }

    // 2. GST (admin-configurable, defaults to 3%) on the DISCOUNTED taxable
    //    subtotal. Gift vouchers are tax-inclusive and excluded from the base.
    const gstPercent = await this.pricingConfigRepository.getGstPercent();
    const discountedTaxable = Math.max(0, round2(taxableSubtotal - discount));
    const taxAmount = round2(discountedTaxable * (gstPercent / 100));

    // 3. Zone delivery charge (from delivery-config) is added LAST, resolved
    //    from the shipping address. No address -> no charge (added at checkout).
    const address: CheckoutAddress | null =
      input.address ?? (input.pincode ? { pincode: String(input.pincode) } : null);
    const deliveryZone = resolveDeliveryZone(address);
    let deliveryFee = 0;
    if (deliveryZone) {
      const deliveryConfig = await this.deliveryConfigRepository.getConfig();
      deliveryFee = Number(deliveryConfig[deliveryZone]) || 0;
    }

    const grandTotal = Math.max(0, round2(subtotal - discount + taxAmount + deliveryFee));

    return {
      items,
      subtotal,
      taxableSubtotal,
      discount,
      couponCode,
      gstPercent,
      taxAmount,
      deliveryZone,
      deliveryFee,
      grandTotal,
      amountInPaise: Math.round(grandTotal * 100),
    };
  }
}
