import { StaleMetal } from '../domain/rates';
import { queryOne } from '../infrastructure/postgres/pool';
import { toBool, toDate, toStrArray } from '../infrastructure/postgres/mapping';

export { StaleMetal };

export interface RateStatusView {
  blocked: boolean;
  staleMetals: StaleMetal[];
  checkedAt: string;
}

const GLOBAL_KEY = 'global';

const DEFAULT_STATUS: RateStatusView = {
  blocked: false,
  staleMetals: [],
  checkedAt: new Date(0).toISOString(),
};

interface RateStatusRow {
  blocked: boolean;
  stale_metals: string[] | null;
  checked_at: Date | null;
}

const toView = (row: RateStatusRow): RateStatusView => ({
  blocked: toBool(row.blocked),
  staleMetals: toStrArray(row.stale_metals) as StaleMetal[],
  checkedAt: (toDate(row.checked_at) ?? new Date(0)).toISOString(),
});

export class RateStatusRepository {
  /** Current block flag, or a safe "never checked / unblocked" default when unset. */
  public async getStatus(): Promise<RateStatusView> {
    const row = await queryOne<RateStatusRow>(
      'SELECT blocked, stale_metals, checked_at FROM rate_status WHERE key = $1',
      [GLOBAL_KEY],
    );
    return row ? toView(row) : { ...DEFAULT_STATUS };
  }

  public async setStatus(
    blocked: boolean,
    staleMetals: StaleMetal[],
    checkedAt: Date = new Date(),
  ): Promise<RateStatusView> {
    const row = await queryOne<RateStatusRow>(
      `INSERT INTO rate_status (key, blocked, stale_metals, checked_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         blocked      = EXCLUDED.blocked,
         stale_metals = EXCLUDED.stale_metals,
         checked_at   = EXCLUDED.checked_at,
         updated_at   = NOW()
       RETURNING blocked, stale_metals, checked_at`,
      [GLOBAL_KEY, blocked, staleMetals, checkedAt],
    );

    return toView(row!);
  }
}
