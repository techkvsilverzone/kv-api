import { MetalRateService } from './metalrate.service';
import { istDayKey } from '../utils/time';

export interface LegacySilverRateResponse {
  id: string;
  rateDate: string;
  purity: '999';
  ratePerGram: number;
  ratePerKg: number;
  createdAt: string;
  updatedBy?: string;
}

export class SilverRateService {
  private readonly metalRateService: MetalRateService;

  constructor() {
    this.metalRateService = new MetalRateService();
  }

  public async getTodayRates() {
    const rates = await this.metalRateService.getTodayRates('SILVER');
    return rates.map((rate) => this.toLegacySilverRate(rate));
  }

  public async getHistory(days: number) {
    const rates = await this.metalRateService.getHistory(days, 'SILVER');
    return rates.map((rate) => this.toLegacySilverRate(rate));
  }

  public async getAllRates() {
    const rates = await this.metalRateService.getAllRates('SILVER');
    return rates.map((rate) => this.toLegacySilverRate(rate));
  }

  public async upsertRate(ratePerGram: number, _purity: string, updatedBy?: string) {
    // IST calendar day, not UTC — must agree with the rate-freshness guard's
    // day comparison, or a rate saved between 00:00-05:30 IST silently lands
    // under yesterday's date and the admin panel stays locked.
    const today = istDayKey();
    const rate = await this.metalRateService.upsertRate(
      {
        date: today,
        metal: 'SILVER',
        karat: null,
        ratePerGram,
      },
      updatedBy,
    );

    return this.toLegacySilverRate(rate);
  }

  private toLegacySilverRate(rate: {
    id: string;
    date: string;
    ratePerGram: number;
    ratePerKg: number;
    createdAt: string;
    updatedBy?: string;
  }): LegacySilverRateResponse {
    return {
      id: rate.id,
      rateDate: rate.date,
      purity: '999',
      ratePerGram: rate.ratePerGram,
      ratePerKg: rate.ratePerKg,
      createdAt: rate.createdAt,
      ...(rate.updatedBy ? { updatedBy: rate.updatedBy } : {}),
    };
  }
}
