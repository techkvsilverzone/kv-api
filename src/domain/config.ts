/**
 * Single-row configuration aggregates.
 *
 * Each of these was a one-document Mongo collection keyed `global` and is now a
 * one-row table keyed on a unique `key` column, so the upsert-by-key shape is
 * unchanged.
 */

interface ConfigBase {
  _id: string;
  key: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface IStoreConfig extends ConfigBase {
  theme: string;
  isDark: boolean;
  marqueeMessages: string[];
}

export interface IPricingConfig extends ConfigBase {
  gstPercent: number;
}

export interface IDeliveryConfig extends ConfigBase {
  chennai: number;
  otherDistrict: number;
  otherState: number;
}

export interface IPriceRange {
  label: string;
  value: string;
}

export interface IFilterConfig extends ConfigBase {
  hiddenCategories: string[];
  metals: string[];
  priceRanges: IPriceRange[];
}

export interface IInvoiceConfig extends ConfigBase {
  companyName: string;
  gstin: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
}

export interface IStallConfig extends ConfigBase {
  /** Maps to the `stall_config.is_enabled` column, which kept the DBA's naming. */
  active: boolean;
}
