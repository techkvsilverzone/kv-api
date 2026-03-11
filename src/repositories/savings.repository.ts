import mongoose from 'mongoose';
import { Savings, ISavings } from '../models/savings.model';

export class SavingsRepository {
  public async create(data: any): Promise<ISavings> {
    const savings = new Savings({
      userId: new mongoose.Types.ObjectId(String(data.user || data.userId)),
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

  public async findById(id: string): Promise<ISavings | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Savings.findById(id).exec();
  }

  public async recordPayment(schemeId: string, amount: number, month: number): Promise<ISavings | null> {
    return Savings.findByIdAndUpdate(
      schemeId,
      {
        $inc: { totalPaid: amount },
        $push: { payments: { month, amount, paidAt: new Date() } },
      },
      { new: true },
    ).exec();
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
