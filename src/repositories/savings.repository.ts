import mongoose from 'mongoose';
import { Savings, ISavings } from '../models/savings.model';

export class SavingsRepository {
  /**
   * Only used once a scheme's first payment lands (see `recordPayment`) — enrollment
   * alone no longer mints a passbook number. `passbookNumber` is a sparse-unique field
   * (see savings.model.ts) precisely so a fresh enrollment can sit with it unset.
   */
  private async generatePassbookNumber(): Promise<string> {
    const count = await Savings.countDocuments({ passbookNumber: { $exists: true } });
    const seq = (count + 1).toString().padStart(8, '0');
    return `PB-${seq}`;
  }

  public async create(data: any): Promise<ISavings> {
    const savings = new Savings({
      userId: new mongoose.Types.ObjectId(String(data.user || data.userId)),
      // passbookNumber intentionally omitted — a real passbook is only issued once this
      // customer makes their first actual payment (see `recordPayment`).
      planName: String(data.planName || 'Silver Savings'),
      monthlyAmount: Number(data.monthlyAmount || 0),
      duration: Number(data.duration || 11),
      bonusAmount: Number(data.bonusAmount || 0),
      totalPaid: Number(data.totalPaid || 0),
      status: 'Active',
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
   * moment a real passbook is minted.
   */
  public async recordPayment(
    schemeId: string,
    amount: number,
    month: number,
    assignPassbook = false,
  ): Promise<ISavings | null> {
    const update: Record<string, unknown> = {
      $inc: { totalPaid: amount },
      $push: { payments: { month, amount, paidAt: new Date() } },
    };
    if (assignPassbook) {
      update.$set = { passbookNumber: await this.generatePassbookNumber() };
    }
    return Savings.findByIdAndUpdate(schemeId, update, { new: true }).exec();
  }

  public async getPayments(schemeId: string): Promise<any[]> {
    const savings = await Savings.findById(schemeId).exec();
    if (!savings) return [];
    return savings.payments.map((p) => ({
      month: p.month,
      amount: p.amount,
      paidAt: p.paidAt,
    }));
  }
}
