import { PincodeRate, IPincodeRate } from '../models/pincodeRate.model';

export class PincodeRateRepository {
  public async findAll(): Promise<IPincodeRate[]> {
    return PincodeRate.find().sort({ pincode: 1 }).exec();
  }

  public async findByPincode(pincode: string): Promise<IPincodeRate | null> {
    return PincodeRate.findOne({ pincode: pincode.trim() }).exec();
  }

  public async create(data: { pincode: string; label: string; rate: number }): Promise<IPincodeRate> {
    const entry = new PincodeRate({
      pincode: data.pincode.trim(),
      label: data.label.trim(),
      rate: Number(data.rate),
    });
    return entry.save();
  }

  public async deleteByPincode(pincode: string): Promise<boolean> {
    const result = await PincodeRate.findOneAndDelete({ pincode: pincode.trim() }).exec();
    return result !== null;
  }
}
