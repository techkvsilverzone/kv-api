import mongoose from 'mongoose';
import { SavingsRepository } from '../repositories/savings.repository';
import { Savings } from '../models/savings.model';
import { SavingsService } from '../services/savings.service';
import { UserRepository } from '../repositories/user.repository';

// Business rule: a passbook (the customer-facing PB-xxxxxxxx number) is only minted once
// a real payment has been made — enrollment alone must not issue one. See
// docs/25-price-update-guard-and-notification.md-adjacent savings docs / cerebrum for context.
describe('SavingsRepository — passbook only minted on first payment', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('create (enrollment)', () => {
    it('does not set a passbookNumber at enrollment', async () => {
      jest.spyOn(Savings.prototype, 'save').mockImplementation(function (this: unknown) {
        return Promise.resolve(this);
      } as never);

      const userId = new mongoose.Types.ObjectId().toString();
      const created = await new SavingsRepository().create({
        user: userId,
        planName: 'Silver Saver',
        monthlyAmount: 2000,
        duration: 11,
      });

      expect(created.passbookNumber).toBeUndefined();
    });
  });

  describe('recordPayment', () => {
    it('mints a passbook number from the count of already-issued passbooks when assignPassbook is true', async () => {
      const countSpy = jest.spyOn(Savings, 'countDocuments').mockResolvedValue(4 as never);
      const updateSpy = jest.spyOn(Savings, 'findByIdAndUpdate').mockReturnValue({
        exec: jest.fn().mockResolvedValue({ passbookNumber: 'PB-00000005' }),
      } as never);

      await new SavingsRepository().recordPayment('scheme1', 2000, 1, true);

      expect(countSpy).toHaveBeenCalledWith({ passbookNumber: { $exists: true } });
      expect(updateSpy).toHaveBeenCalledWith(
        'scheme1',
        expect.objectContaining({ $set: { passbookNumber: 'PB-00000005' } }),
        { new: true },
      );
    });

    it('does not touch passbookNumber on a later payment', async () => {
      const countSpy = jest.spyOn(Savings, 'countDocuments');
      const updateSpy = jest.spyOn(Savings, 'findByIdAndUpdate').mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as never);

      await new SavingsRepository().recordPayment('scheme1', 2000, 2, false);

      expect(countSpy).not.toHaveBeenCalled();
      const [, update] = updateSpy.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(update).not.toHaveProperty('$set');
    });
  });
});

describe('SavingsService.recordPayment — decides when a passbook gets minted', () => {
  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(null);
    jest.spyOn(SavingsRepository.prototype, 'getPayments').mockResolvedValue([]);
  });

  it('requests passbook assignment on the scheme\'s very first payment', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({
      _id: 's1',
      userId: { toString: () => 'u1' },
      monthlyAmount: 2000,
      payments: [],
      passbookNumber: undefined,
    } as never);
    const recordSpy = jest
      .spyOn(SavingsRepository.prototype, 'recordPayment')
      .mockResolvedValue({ passbookNumber: 'PB-00000001', totalPaid: 2000 } as never);

    await new SavingsService().recordPayment('u1', 's1', 2000, 1);

    expect(recordSpy).toHaveBeenCalledWith('s1', 2000, 1, true);
  });

  it('does not re-request passbook assignment on a later payment', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({
      _id: 's1',
      userId: { toString: () => 'u1' },
      monthlyAmount: 2000,
      payments: [{ month: 1, amount: 2000, paidAt: new Date() }],
      passbookNumber: 'PB-00000001',
    } as never);
    const recordSpy = jest
      .spyOn(SavingsRepository.prototype, 'recordPayment')
      .mockResolvedValue({ passbookNumber: 'PB-00000001', totalPaid: 4000 } as never);

    await new SavingsService().recordPayment('u1', 's1', 2000, 2);

    expect(recordSpy).toHaveBeenCalledWith('s1', 2000, 2, false);
  });

  it('still mints a passbook if payments is somehow empty but a passbookNumber was never set', async () => {
    // Defensive case: an old/partially-migrated record with no payments and no passbook.
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({
      _id: 's1',
      userId: { toString: () => 'u1' },
      monthlyAmount: 2000,
      payments: [],
      passbookNumber: undefined,
    } as never);
    const recordSpy = jest
      .spyOn(SavingsRepository.prototype, 'recordPayment')
      .mockResolvedValue({ passbookNumber: 'PB-00000002', totalPaid: 2000 } as never);

    await new SavingsService().recordPayment('u1', 's1', 2000, 1);

    expect(recordSpy).toHaveBeenCalledWith('s1', 2000, 1, true);
  });
});
