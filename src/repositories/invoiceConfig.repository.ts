import { InvoiceConfig, IInvoiceConfig } from '../models/invoiceConfig.model';

const GLOBAL_KEY = 'global';

export interface InvoiceConfigValues {
  companyName: string;
  gstin: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
}

export const DEFAULT_INVOICE_CONFIG: InvoiceConfigValues = {
  companyName: 'KV Silver Zone',
  gstin: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
};

export class InvoiceConfigRepository {
  public async get(): Promise<IInvoiceConfig | null> {
    return InvoiceConfig.findOne({ key: GLOBAL_KEY }).exec();
  }

  public async getConfig(): Promise<InvoiceConfigValues> {
    const config = await this.get();
    if (!config) return { ...DEFAULT_INVOICE_CONFIG };
    return {
      companyName: config.companyName,
      gstin: config.gstin,
      companyAddress: config.companyAddress,
      companyPhone: config.companyPhone,
      companyEmail: config.companyEmail,
    };
  }

  public async upsert(data: Partial<InvoiceConfigValues>): Promise<IInvoiceConfig> {
    return InvoiceConfig.findOneAndUpdate(
      { key: GLOBAL_KEY },
      { $set: data },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec() as Promise<IInvoiceConfig>;
  }
}
