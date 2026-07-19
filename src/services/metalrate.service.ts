import { AppError } from '../utils/appError';
import { IMetalRate, MetalType } from '../models/metalrate.model';
import { MetalRateRepository } from '../repositories/metalrate.repository';
import { istDayKey, istMidnightUtc } from '../utils/time';

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
    // Pin to IST midnight for the given calendar day, NOT UTC or server-local
    // midnight — the rate-freshness guard compares by IST day, so the anchor
    // used to store a rate must agree with it or "today's" rate silently
    // lands under yesterday's key during the UTC/IST offset window.
    const dayKey = String(payload.date || '').slice(0, 10);
    const parsedDate = dayKey ? istMidnightUtc(dayKey) : new Date(NaN);
    if (!payload.date || Number.isNaN(parsedDate.getTime())) {
      throw new AppError('date must be a valid ISO date (YYYY-MM-DD)', 400);
    }

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
      // rate.date is stored as IST-midnight-in-UTC (istMidnightUtc), which for any
      // IST calendar day falls on the PREVIOUS UTC calendar day (IST is UTC+5:30) —
      // a naive .toISOString().slice(0,10) would therefore always report the date
      // as one day earlier than the IST day the record actually represents. Derive
      // the IST day directly instead, so the freshness checks that read this field
      // (isSameLocalDay client-side, isSameIstDay server-side) agree with storage.
      date: istDayKey(rate.date),
      metal: rate.metal,
      karat: rate.karat,
      ratePerGram: rate.ratePerGram,
      ratePerKg: rate.ratePerKg,
      createdAt: rate.createdAt.toISOString(),
      ...(rate.updatedBy ? { updatedBy: rate.updatedBy } : {}),
    };
  }
}
