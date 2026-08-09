import mongoose from 'mongoose';
import { Savings, ISavings, ISavingsPayment, ICancellation, IMaturityBenefits } from '../models/savings.model';
import { financialYearCode } from '../utils/time';

type PaymentRowPatch = Partial<
  Pick<
    ISavingsPayment,
    'amount' | 'paidAt' | 'materialRate' | 'materialWeight' | 'devidentAmount' | 'devidentMaterialRate' | 'devidentMaterialWeight'
  >
>;

export class SavingsRepository {
  /**
   * Only used once a scheme's first payment lands (see `recordPayment`) — enrollment
   * alone no longer mints a passbook number. `passbookNumber` is a sparse-unique field
   * (see savings.model.ts) precisely so a fresh enrollment can sit with it unset.
   *
   * Format is per-scheme-type: `{prefix}-{financialYearCode}-{7-digit seq}`, e.g.
   * 'GLD-2425-0000012'. The sequence counts only passbooks already issued under that same
   * prefix (not reset per financial year, not shared across scheme types). Pre-rework
   * passbooks minted without a prefix (bare `2425-0000111`) are untouched and excluded from
   * every prefix's count.
   */
  public async generatePassbookNumber(prefix: string): Promise<string> {
    const count = await Savings.countDocuments({ passbookNumber: { $regex: `^${prefix}-` } });
    const seq = (count + 1).toString().padStart(7, '0');
    return `${prefix}-${financialYearCode(new Date())}-${seq}`;
  }

  public async create(data: any): Promise<ISavings> {
    const savings = new Savings({
      userId: new mongoose.Types.ObjectId(String(data.user || data.userId)),
      // passbookNumber intentionally omitted — a real passbook is only issued once this
      // customer makes their first actual payment (see `recordPayment`).
      schemeType: data.schemeType || 'SILVER_11_1',
      planId: data.planId ? new mongoose.Types.ObjectId(String(data.planId)) : undefined,
      metal: data.metal,
      planName: String(data.planName || 'Silver Savings'),
      monthlyAmount: Number(data.monthlyAmount || 0),
      duration: Number(data.duration || 11),
      bonusAmount: Number(data.bonusAmount || 0),
      totalPaid: Number(data.totalPaid || 0),
      status: 'Active',
      maturityBenefits: data.maturityBenefits,
      startDate: data.startDate || new Date(),
    });
    return savings.save();
  }

  public async findByUserId(userId: string): Promise<ISavings[]> {
    return Savings.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findAll(): Promise<ISavings[]> {
    return Savings.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Active schemes with the owner's phone populated — used by the daily reminder cron. */
  public async findActiveWithUserPhone(): Promise<ISavings[]> {
    return Savings.find({ status: 'Active' })
      .populate('userId', 'name phone')
      .exec();
  }

  public async findById(id: string): Promise<ISavings | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Savings.findById(id).exec();
  }

  public async findByPassbookNumber(passbookNumber: string): Promise<ISavings | null> {
    return Savings.findOne({ passbookNumber: passbookNumber.trim().toUpperCase() }).exec();
  }

  public async updateById(id: string, data: Partial<ISavings>): Promise<ISavings | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Savings.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  public async deleteById(id: string): Promise<ISavings | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Savings.findByIdAndDelete(id).exec();
  }

  /**
   * `assignPassbook` is set by the caller (SavingsService) when this is the scheme's
   * first-ever payment and it doesn't already have a passbook number — that's the one
   * moment a real passbook is minted, using this scheme's `passbookPrefix`.
   * `materialRate`/`materialWeight` are already resolved by the caller (live rate for the
   * scheme's metal, or an admin override) — this method just persists them.
   */
  public async recordPayment(
    schemeId: string,
    row: {
      month: number;
      amount: number;
      materialRate: number;
      materialWeight: number;
      method: 'ONLINE' | 'CASH';
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      recordedBy?: string;
      dueMonthKey: string;
    },
    assignPassbook = false,
    passbookPrefix?: string,
  ): Promise<ISavings | null> {
    const update: Record<string, unknown> = {
      $inc: { totalPaid: row.amount },
      $push: {
        payments: {
          month: row.month,
          amount: row.amount,
          paidAt: new Date(),
          materialRate: row.materialRate,
          materialWeight: row.materialWeight,
          devidentAmount: 0,
          devidentMaterialRate: 0,
          devidentMaterialWeight: 0,
          method: row.method,
          razorpayOrderId: row.razorpayOrderId,
          razorpayPaymentId: row.razorpayPaymentId,
          recordedBy: row.recordedBy ? new mongoose.Types.ObjectId(row.recordedBy) : undefined,
          dueMonthKey: row.dueMonthKey,
        },
      },
    };
    if (assignPassbook) {
      update.$set = { passbookNumber: await this.generatePassbookNumber(passbookPrefix || 'PB') };
    }
    return Savings.findByIdAndUpdate(schemeId, update, { new: true }).exec();
  }

  /**
   * Appends the automatic bonus-month ledger row (no real collection — `amount`/
   * `materialRate`/`materialWeight` are all 0) and marks the scheme Completed. Called once,
   * right after a scheme's Nth real payment (N = plan.durationMonths) — see
   * SavingsService.applyPayment.
   */
  public async creditBonusMonth(
    schemeId: string,
    row: { month: number; devidentAmount: number; devidentMaterialRate: number; devidentMaterialWeight: number },
  ): Promise<ISavings | null> {
    return Savings.findByIdAndUpdate(
      schemeId,
      {
        $push: {
          payments: {
            month: row.month,
            amount: 0,
            paidAt: new Date(),
            materialRate: 0,
            materialWeight: 0,
            devidentAmount: row.devidentAmount,
            devidentMaterialRate: row.devidentMaterialRate,
            devidentMaterialWeight: row.devidentMaterialWeight,
            method: 'ONLINE',
          },
        },
        $set: { status: 'Completed' },
      },
      { new: true },
    ).exec();
  }

  /** Admin-only correction of a single ledger row (see `/admin/savings/:id/payments/:index`). */
  public async updatePaymentRow(schemeId: string, index: number, patch: PaymentRowPatch): Promise<ISavings | null> {
    if (!mongoose.Types.ObjectId.isValid(schemeId)) return null;
    const scheme = await Savings.findById(schemeId).exec();
    const row = scheme?.payments[index];
    if (!scheme || !row) return null;

    const oldAmount = row.amount;
    Object.assign(row, patch);
    if (patch.amount !== undefined) {
      scheme.totalPaid = scheme.totalPaid - oldAmount + patch.amount;
    }
    return scheme.save();
  }

  /** Admin-only removal of an erroneous ledger row. */
  public async deletePaymentRow(schemeId: string, index: number): Promise<ISavings | null> {
    if (!mongoose.Types.ObjectId.isValid(schemeId)) return null;
    const scheme = await Savings.findById(schemeId).exec();
    const row = scheme?.payments[index];
    if (!scheme || !row) return null;

    scheme.totalPaid = Math.max(0, scheme.totalPaid - row.amount);
    scheme.payments.splice(index, 1);
    return scheme.save();
  }

  public async getPayments(schemeId: string): Promise<ISavingsPayment[]> {
    const savings = await Savings.findById(schemeId).exec();
    if (!savings) return [];
    return savings.payments.map((p) => ({
      month: p.month,
      amount: p.amount,
      paidAt: p.paidAt,
      materialRate: p.materialRate,
      materialWeight: p.materialWeight,
      devidentAmount: p.devidentAmount,
      devidentMaterialRate: p.devidentMaterialRate,
      devidentMaterialWeight: p.devidentMaterialWeight,
      method: p.method,
      razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId,
      recordedBy: p.recordedBy,
      dueMonthKey: p.dueMonthKey,
    }));
  }

  /** Card rule 6 (early exit): records the forfeit/redeemable split and cancels the scheme. */
  public async cancelScheme(schemeId: string, cancellation: ICancellation): Promise<ISavings | null> {
    if (!mongoose.Types.ObjectId.isValid(schemeId)) return null;
    return Savings.findByIdAndUpdate(
      schemeId,
      { $set: { status: 'Cancelled', cancellation } },
      { new: true },
    ).exec();
  }

  /** Diwali-only: persists the computed redemption payout (gold value/grams, silver value,
   * gifts value) onto maturityBenefits once the scheme has completed all installments. */
  public async setMaturityBenefits(schemeId: string, maturityBenefits: IMaturityBenefits): Promise<ISavings | null> {
    if (!mongoose.Types.ObjectId.isValid(schemeId)) return null;
    return Savings.findByIdAndUpdate(schemeId, { $set: { maturityBenefits } }, { new: true }).exec();
  }

  /** Reminder cron: active schemes of a given type, owner phone populated. */
  public async findActiveByTypeWithUserPhone(schemeType: string): Promise<ISavings[]> {
    return Savings.find({ status: 'Active', schemeType })
      .populate('userId', 'name phone')
      .exec();
  }
}
