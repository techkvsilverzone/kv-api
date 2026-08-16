export type MetalType = 'SILVER' | 'GOLD';
export type StaleMetal = 'silver' | 'gold';

/**
 * A metal rate for one IST calendar day.
 *
 * `date` is stored as a PostgreSQL DATE and surfaced as the UTC instant of that
 * IST day's midnight, which is exactly what `istMidnightUtc` produced before —
 * so the freshness comparisons in rateGuard.service are unaffected.
 */
export interface IMetalRate {
  _id: string;
  date: Date;
  metal: MetalType;
  karat: number | null;
  ratePerGram: number;
  ratePerKg: number;
  updatedBy?: string | null;
  /** NOT NULL in the schema, so always present. */
  createdAt: Date;
  updatedAt: Date;
}

export interface ISilverRate {
  _id: string;
  rateDate: Date;
  purity: '999' | '925' | '916';
  ratePerGram: number;
  ratePerKg: number;
  updatedBy?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface IRateStatus {
  key: string;
  blocked: boolean;
  staleMetals: StaleMetal[];
  checkedAt: Date;
}
