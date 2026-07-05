import { MetalRateService } from './metalrate.service';

// 22K gold hallmark. Mirrors how the silver service pins purity to '999';
// the MetalRate collection stores karat (22), not the purity string.
const DEFAULT_GOLD_PURITY = '916';
const GOLD_KARAT = 22;

export interface LegacyGoldRateResponse {
  id: string;
  // Both keys are emitted so the frontend works whether it reads `date`
  // (per the #25 spec) or `rateDate` (matching the silver service shape).
  date: string;
  rateDate: string;
  purity: string;
  ratePerGram: number;
  ratePerKg: number;
  createdAt: string;
  updatedBy?: string;
}

export class GoldRateService {
  private readonly metalRateService: MetalRateService;

  constructor() {
    this.metalRateService = new MetalRateService();
  }

  public async getTodayRates() {
    const rates = await this.metalRateService.getTodayRates('GOLD');
    return rates.map((rate) => this.toLegacyGoldRate(rate));
  }

  public async getHistory(days: number) {
    const rates = await this.metalRateService.getHistory(days, 'GOLD');
    return rates.map((rate) => this.toLegacyGoldRate(rate));
  }

  public async getAllRates() {
    const rates = await this.metalRateService.getAllRates('GOLD');
    return rates.map((rate) => this.toLegacyGoldRate(rate));
  }

  public async upsertRate(ratePerGram: number, _purity: string, updatedBy?: string) {
    const today = new Date().toISOString().slice(0, 10);
    const rate = await this.metalRateService.upsertRate(
      {
        date: today,
        metal: 'GOLD',
        karat: GOLD_KARAT,
        ratePerGram,
      },
      updatedBy,
    );

    return this.toLegacyGoldRate(rate);
  }

  private toLegacyGoldRate(rate: {
    id: string;
    date: string;
    ratePerGram: number;
    ratePerKg: number;
    createdAt: string;
    updatedBy?: string;
  }): LegacyGoldRateResponse {
    return {
      id: rate.id,
      date: rate.date,
      rateDate: rate.date,
      purity: DEFAULT_GOLD_PURITY,
      ratePerGram: rate.ratePerGram,
      ratePerKg: rate.ratePerKg,
      createdAt: rate.createdAt,
      ...(rate.updatedBy ? { updatedBy: rate.updatedBy } : {}),
    };
  }
}
