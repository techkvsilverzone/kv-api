import { RateStatus, IRateStatus, StaleMetal } from '../models/rateStatus.model';

export interface RateStatusView {
  blocked: boolean;
  staleMetals: StaleMetal[];
  checkedAt: string;
}

const DEFAULT_STATUS: RateStatusView = {
  blocked: false,
  staleMetals: [],
  checkedAt: new Date(0).toISOString(),
};

export class RateStatusRepository {
  /** Current block flag, or a safe "never checked / unblocked" default when unset. */
  public async getStatus(): Promise<RateStatusView> {
    const doc = await RateStatus.findOne({ key: 'global' }).exec();
    if (!doc) return { ...DEFAULT_STATUS };
    return this.toView(doc);
  }

  public async setStatus(
    blocked: boolean,
    staleMetals: StaleMetal[],
    checkedAt: Date = new Date(),
  ): Promise<RateStatusView> {
    const doc = (await RateStatus.findOneAndUpdate(
      { key: 'global' },
      { key: 'global', blocked, staleMetals, checkedAt },
      { upsert: true, new: true },
    ).exec()) as IRateStatus;
    return this.toView(doc);
  }

  private toView(doc: IRateStatus): RateStatusView {
    return {
      blocked: doc.blocked,
      staleMetals: doc.staleMetals ?? [],
      checkedAt: doc.checkedAt.toISOString(),
    };
  }
}
