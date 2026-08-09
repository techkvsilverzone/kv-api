import mongoose from 'mongoose';
import { SchemePlan, ISchemePlan, SchemeType } from '../models/schemePlan.model';

export class SchemePlanRepository {
  public async findActive(): Promise<ISchemePlan[]> {
    return SchemePlan.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).exec();
  }

  public async findAll(): Promise<ISchemePlan[]> {
    return SchemePlan.find().sort({ sortOrder: 1, name: 1 }).exec();
  }

  public async findById(id: string): Promise<ISchemePlan | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return SchemePlan.findById(id).exec();
  }

  public async findByType(type: SchemeType): Promise<ISchemePlan | null> {
    return SchemePlan.findOne({ type }).exec();
  }

  public async create(data: Partial<ISchemePlan>): Promise<ISchemePlan> {
    const plan = new SchemePlan(data);
    return plan.save();
  }

  public async update(id: string, data: Partial<ISchemePlan>): Promise<ISchemePlan | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return SchemePlan.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  public async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await SchemePlan.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
