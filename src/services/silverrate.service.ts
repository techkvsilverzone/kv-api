import { SilverRateRepository } from '../repositories/silverrate.repository';

export class SilverRateService {
  private silverRateRepository: SilverRateRepository;

  constructor() {
    this.silverRateRepository = new SilverRateRepository();
  }

  public async getTodayRates() {
    return await this.silverRateRepository.findToday();
  }

  public async getHistory(days: number) {
    const d = Number.isFinite(days) && days > 0 ? days : 30;
    return await this.silverRateRepository.findHistory(d);
  }

  public async getAllRates() {
    return await this.silverRateRepository.findAll();
  }

  public async upsertRate(ratePerGram: number, purity: string, updatedBy?: string) {
    return await this.silverRateRepository.upsertTodayRate(ratePerGram, purity, updatedBy);
  }
}
