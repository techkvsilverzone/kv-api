import { SchemePlanRepository } from '../repositories/schemePlan.repository';
import { ISchemeHamper, SchemeType } from '../models/schemePlan.model';
import { AppError } from '../utils/appError';

const SCHEME_TYPES: SchemeType[] = ['GOLD_11_1', 'SILVER_11_1', 'DIWALI', 'GOLD_INCOME', 'SILVER_DEPOSIT'];
const METALS = ['GOLD', 'SILVER'];
const REDEMPTION_MODES = ['GOODS_ONLY', 'CASH_ALLOWED'];

function parseHamper(input: any): ISchemeHamper | undefined {
  if (input === undefined) return undefined;
  if (input === null) return undefined;
  const silverCoinGrams = input.silverCoinGrams !== undefined ? Number(input.silverCoinGrams) : undefined;
  const giftsValue = input.giftsValue !== undefined ? Number(input.giftsValue) : undefined;
  if (silverCoinGrams !== undefined && (!Number.isFinite(silverCoinGrams) || silverCoinGrams < 0)) {
    throw new AppError('hamper.silverCoinGrams must be a non-negative number', 400);
  }
  if (giftsValue !== undefined && (!Number.isFinite(giftsValue) || giftsValue < 0)) {
    throw new AppError('hamper.giftsValue must be a non-negative number', 400);
  }
  const gifts = Array.isArray(input.gifts)
    ? input.gifts.map((g: unknown) => String(g).trim()).filter(Boolean)
    : [];
  return {
    goldCoinPurity: input.goldCoinPurity ? String(input.goldCoinPurity).trim() : undefined,
    silverCoinGrams,
    giftsValue,
    gifts,
  };
}

export class SchemePlanService {
  private repository: SchemePlanRepository;

  constructor() {
    this.repository = new SchemePlanRepository();
  }

  /** Public storefront catalog — active plans only. */
  public async getActivePlans() {
    return this.repository.findActive();
  }

  /** Admin catalog — includes inactive/draft plans. */
  public async getAllPlans() {
    return this.repository.findAll();
  }

  public async getByType(type: SchemeType) {
    const plan = await this.repository.findByType(type);
    if (!plan) throw new AppError(`No scheme plan configured for ${type}`, 404);
    return plan;
  }

  private buildFields(data: any, isCreate: boolean): Record<string, unknown> {
    const update: Record<string, unknown> = {};

    if (isCreate || data.type !== undefined) {
      const type = String(data.type);
      if (!SCHEME_TYPES.includes(type as SchemeType)) {
        throw new AppError(`type must be one of ${SCHEME_TYPES.join(', ')}`, 400);
      }
      update.type = type;
    }

    if (isCreate || data.name !== undefined) {
      const name = String(data.name || '').trim();
      if (!name) throw new AppError('name is required', 400);
      update.name = name;
    }

    if (data.description !== undefined) update.description = data.description;
    if (data.isActive !== undefined) update.isActive = Boolean(data.isActive);

    if (data.metal !== undefined) {
      if (data.metal !== null && !METALS.includes(data.metal)) {
        throw new AppError('metal must be GOLD or SILVER', 400);
      }
      update.metal = data.metal ?? undefined;
    }

    if (isCreate || data.durationMonths !== undefined) {
      const durationMonths = Number(data.durationMonths);
      if (!Number.isInteger(durationMonths) || durationMonths < 1) {
        throw new AppError('durationMonths must be a positive whole number', 400);
      }
      update.durationMonths = durationMonths;
    }

    if (data.bonusMonths !== undefined) {
      const bonusMonths = Number(data.bonusMonths);
      if (!Number.isInteger(bonusMonths) || bonusMonths < 0) {
        throw new AppError('bonusMonths must be a non-negative whole number', 400);
      }
      update.bonusMonths = bonusMonths;
    }

    if (data.monthlyAmounts !== undefined) {
      if (!Array.isArray(data.monthlyAmounts) || data.monthlyAmounts.length === 0) {
        throw new AppError('monthlyAmounts must be a non-empty array', 400);
      }
      const amounts = data.monthlyAmounts.map((a: unknown) => Number(a));
      if (amounts.some((a: number) => !Number.isInteger(a) || a < 1000)) {
        throw new AppError('monthlyAmounts must be whole numbers of at least 1000', 400);
      }
      update.monthlyAmounts = amounts;
    }

    if (isCreate || data.passbookPrefix !== undefined) {
      const passbookPrefix = String(data.passbookPrefix || '').trim().toUpperCase();
      if (!/^[A-Z]{2,6}$/.test(passbookPrefix)) {
        throw new AppError('passbookPrefix must be 2-6 letters', 400);
      }
      update.passbookPrefix = passbookPrefix;
    }

    if (data.paymentDueDayOfMonth !== undefined) {
      const day = Number(data.paymentDueDayOfMonth);
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        throw new AppError('paymentDueDayOfMonth must be a whole number between 1 and 28', 400);
      }
      update.paymentDueDayOfMonth = day;
    }

    if (data.earlyExitPenaltyPercent !== undefined) {
      const percent = Number(data.earlyExitPenaltyPercent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new AppError('earlyExitPenaltyPercent must be between 0 and 100', 400);
      }
      update.earlyExitPenaltyPercent = percent;
    }

    if (data.maxConsecutiveMissedMonths !== undefined) {
      const months = Number(data.maxConsecutiveMissedMonths);
      if (!Number.isInteger(months) || months < 1) {
        throw new AppError('maxConsecutiveMissedMonths must be a positive whole number', 400);
      }
      update.maxConsecutiveMissedMonths = months;
    }

    if (data.redemptionMode !== undefined) {
      if (!REDEMPTION_MODES.includes(data.redemptionMode)) {
        throw new AppError(`redemptionMode must be one of ${REDEMPTION_MODES.join(', ')}`, 400);
      }
      update.redemptionMode = data.redemptionMode;
    }

    if (data.hamper !== undefined) {
      update.hamper = parseHamper(data.hamper);
    }

    if (data.sortOrder !== undefined) update.sortOrder = Number(data.sortOrder);

    return update;
  }

  public async createPlan(data: any) {
    const fields = this.buildFields(data, true);
    const existing = await this.repository.findByType(fields.type as SchemeType);
    if (existing) throw new AppError(`A plan for ${fields.type} already exists — edit it instead`, 400);
    return this.repository.create(fields);
  }

  public async updatePlan(id: string, data: any) {
    const fields = this.buildFields(data, false);
    if (Object.keys(fields).length === 0) throw new AppError('No valid fields provided to update', 400);
    const updated = await this.repository.update(id, fields);
    if (!updated) throw new AppError('Scheme plan not found', 404);
    return updated;
  }

  public async deletePlan(id: string) {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new AppError('Scheme plan not found', 404);
  }
}
