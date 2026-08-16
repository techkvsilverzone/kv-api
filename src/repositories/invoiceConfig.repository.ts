import { IInvoiceConfig } from '../domain/config';
import { queryOne } from '../infrastructure/postgres/pool';
import { toDate } from '../infrastructure/postgres/mapping';

export { IInvoiceConfig };

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

interface InvoiceConfigRow {
  id: string;
  key: string;
  company_name: string;
  gstin: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  created_at: Date | null;
  updated_at: Date | null;
}

const mapConfig = (row: InvoiceConfigRow): IInvoiceConfig => ({
  _id: String(row.id),
  key: row.key,
  companyName: row.company_name,
  gstin: row.gstin,
  companyAddress: row.company_address,
  companyPhone: row.company_phone,
  companyEmail: row.company_email,
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

const SELECT = `
  SELECT id, key, company_name, gstin, company_address, company_phone, company_email,
         created_at, updated_at
  FROM invoice_config`;

export class InvoiceConfigRepository {
  public async get(): Promise<IInvoiceConfig | null> {
    const row = await queryOne<InvoiceConfigRow>(`${SELECT} WHERE key = $1`, [GLOBAL_KEY]);
    return row ? mapConfig(row) : null;
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

  /**
   * Partial update: only the fields present on `data` are written, matching the
   * `$set` semantics this repository had. COALESCE keeps the stored value when
   * a parameter is null (i.e. the caller omitted it).
   */
  public async upsert(data: Partial<InvoiceConfigValues>): Promise<IInvoiceConfig> {
    const row = await queryOne<InvoiceConfigRow>(
      `INSERT INTO invoice_config (key, company_name, gstin, company_address, company_phone, company_email)
       VALUES (
         $1,
         COALESCE($2, $7),
         COALESCE($3, $8),
         COALESCE($4, $9),
         COALESCE($5, $10),
         COALESCE($6, $11)
       )
       ON CONFLICT (key) DO UPDATE SET
         company_name    = COALESCE($2, invoice_config.company_name),
         gstin           = COALESCE($3, invoice_config.gstin),
         company_address = COALESCE($4, invoice_config.company_address),
         company_phone   = COALESCE($5, invoice_config.company_phone),
         company_email   = COALESCE($6, invoice_config.company_email),
         updated_at      = NOW()
       RETURNING id, key, company_name, gstin, company_address, company_phone, company_email,
                 created_at, updated_at`,
      [
        GLOBAL_KEY,
        data.companyName ?? null,
        data.gstin ?? null,
        data.companyAddress ?? null,
        data.companyPhone ?? null,
        data.companyEmail ?? null,
        DEFAULT_INVOICE_CONFIG.companyName,
        DEFAULT_INVOICE_CONFIG.gstin,
        DEFAULT_INVOICE_CONFIG.companyAddress,
        DEFAULT_INVOICE_CONFIG.companyPhone,
        DEFAULT_INVOICE_CONFIG.companyEmail,
      ],
    );

    return mapConfig(row!);
  }
}
