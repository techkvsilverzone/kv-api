import { AppError } from '../utils/appError';
import { IMetalRate, MetalType } from '../models/metalrate.model';
import { MetalRateRepository } from '../repositories/metalrate.repository';

export interface MetalRateResponse {
  id: string;
  date: string;
  metal: MetalType;
  karat: number | null;
  ratePerGram: number;
  ratePerKg: number;
  createdAt: string;
  updatedBy?: string;
}

export interface MetalRateUpsertInput {
  date: string;
  metal: MetalType;
  karat: number | null;
  ratePerGram: number;
}

export class MetalRateService {
  private readonly metalRateRepository: MetalRateRepository;

  constructor() {
    this.metalRateRepository = new MetalRateRepository();
  }

  public async getTodayRates(metal?: MetalType): Promise<MetalRateResponse[]> {
    const rates = await this.metalRateRepository.findToday(metal);
    return rates.map((rate) => this.toResponse(rate));
  }

  public async getHistory(days: number, metal?: MetalType): Promise<MetalRateResponse[]> {
    const sanitizedDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
    const rates = await this.metalRateRepository.findHistory(sanitizedDays, metal);
    return rates.map((rate) => this.toResponse(rate));
  }

  public async getAllRates(metal?: MetalType): Promise<MetalRateResponse[]> {
    const rates = await this.metalRateRepository.findAll(metal);
    return rates.map((rate) => this.toResponse(rate));
  }

  public async upsertRate(payload: MetalRateUpsertInput, updatedBy?: string): Promise<MetalRateResponse> {
    const normalized = this.normalizeUpsertInput(payload);

    const rate = await this.metalRateRepository.upsertRate({
      date: normalized.date,
      metal: normalized.metal,
      karat: normalized.karat,
      ratePerGram: normalized.ratePerGram,
      updatedBy,
    });

    return this.toResponse(rate);
  }

  private normalizeUpsertInput(payload: MetalRateUpsertInput): {
    date: Date;
    metal: MetalType;
    karat: number | null;
    ratePerGram: number;
  } {
    const parsedDate = new Date(payload.date);
    if (!payload.date || Number.isNaN(parsedDate.getTime())) {
      throw new AppError('date must be a valid ISO date (YYYY-MM-DD)', 400);
    }
    parsedDate.setHours(0, 0, 0, 0);

    if (payload.metal !== 'SILVER' && payload.metal !== 'GOLD') {
      throw new AppError('metal must be SILVER or GOLD', 400);
    }

    const karat = payload.karat === undefined ? null : payload.karat;
    if (payload.metal === 'SILVER' && karat !== null) {
      throw new AppError('karat must be null for SILVER', 400);
    }
    if (payload.metal === 'GOLD' && karat !== 22) {
      throw new AppError('karat must be 22 for GOLD', 400);
    }

    const ratePerGram = Number(payload.ratePerGram);
    if (!Number.isFinite(ratePerGram) || ratePerGram <= 0) {
      throw new AppError('ratePerGram must be a positive number', 400);
    }

    return {
      date: parsedDate,
      metal: payload.metal,
      karat,
      ratePerGram,
    };
  }

  private toResponse(rate: IMetalRate): MetalRateResponse {
    return {
      id: rate._id.toString(),
      date: rate.date.toISOString().slice(0, 10),
      metal: rate.metal,
      karat: rate.karat,
      ratePerGram: rate.ratePerGram,
      ratePerKg: rate.ratePerKg,
      createdAt: rate.createdAt.toISOString(),
      ...(rate.updatedBy ? { updatedBy: rate.updatedBy } : {}),
    };
  }
}
