import { SavingsService } from '../services/savings.service';
import { SavingsRepository } from '../repositories/savings.repository';
import { AppError } from '../utils/appError';

describe('SavingsService admin passbook correction/deletion', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('adminUpdateScheme', () => {
    it('updates only the provided fields', async () => {
      const updateSpy = jest
        .spyOn(SavingsRepository.prototype, 'updateById')
        .mockResolvedValue({ _id: 's1', status: 'Cancelled' } as never);

      const result = await new SavingsService().adminUpdateScheme('s1', { status: 'Cancelled' });

      expect(updateSpy).toHaveBeenCalledWith('s1', { status: 'Cancelled' });
      expect(result).toEqual({ _id: 's1', status: 'Cancelled' });
    });

    it('rejects an invalid monthlyAmount', async () => {
      await expect(
        new SavingsService().adminUpdateScheme('s1', { monthlyAmount: 500 }),
      ).rejects.toThrow(AppError);
    });

    it('rejects a non-whole-number duration', async () => {
      await expect(
        new SavingsService().adminUpdateScheme('s1', { duration: 7.5 }),
      ).rejects.toThrow(AppError);
    });

    it('rejects an invalid schemeType', async () => {
      await expect(
        new SavingsService().adminUpdateScheme('s1', { schemeType: 'PLATINUM_SCHEME' }),
      ).rejects.toThrow(AppError);
    });

    it('rejects an invalid status', async () => {
      await expect(
        new SavingsService().adminUpdateScheme('s1', { status: 'Paused' }),
      ).rejects.toThrow(AppError);
    });

    it('rejects a negative totalPaid', async () => {
      await expect(
        new SavingsService().adminUpdateScheme('s1', { totalPaid: -100 }),
      ).rejects.toThrow(AppError);
    });

    it('rejects an empty update payload', async () => {
      await expect(new SavingsService().adminUpdateScheme('s1', {})).rejects.toThrow(AppError);
    });

    it('rejects when the scheme does not exist', async () => {
      jest.spyOn(SavingsRepository.prototype, 'updateById').mockResolvedValue(null);

      await expect(
        new SavingsService().adminUpdateScheme('missing', { status: 'Cancelled' }),
      ).rejects.toThrow(AppError);
    });

    it('never forwards passbookNumber even if present in the payload', async () => {
      const updateSpy = jest
        .spyOn(SavingsRepository.prototype, 'updateById')
        .mockResolvedValue({ _id: 's1' } as never);

      await new SavingsService().adminUpdateScheme('s1', {
        passbookNumber: 'PB-99999999',
        planName: 'Renamed Plan',
      });

      expect(updateSpy).toHaveBeenCalledWith('s1', { planName: 'Renamed Plan' });
    });

    it('accepts maturityBenefits, trimming/dropping blank gift entries', async () => {
      const updateSpy = jest
        .spyOn(SavingsRepository.prototype, 'updateById')
        .mockResolvedValue({ _id: 's1' } as never);

      await new SavingsService().adminUpdateScheme('s1', {
        maturityBenefits: { goldCoinValue: 64000, silverGrams: 40, gifts: ['Crackers Box', '  ', 'Sweets and Snacks'] },
      });

      expect(updateSpy).toHaveBeenCalledWith('s1', {
        maturityBenefits: { goldCoinValue: 64000, silverGrams: 40, gifts: ['Crackers Box', 'Sweets and Snacks'] },
      });
    });

    it('rejects a negative maturityBenefits.goldCoinValue', async () => {
      await expect(
        new SavingsService().adminUpdateScheme('s1', { maturityBenefits: { goldCoinValue: -1 } }),
      ).rejects.toThrow(AppError);
    });

    it('rejects a negative maturityBenefits.silverGrams', async () => {
      await expect(
        new SavingsService().adminUpdateScheme('s1', { maturityBenefits: { silverGrams: -1 } }),
      ).rejects.toThrow(AppError);
    });
  });

  describe('adminDeleteScheme', () => {
    it('deletes an existing scheme', async () => {
      const deleteSpy = jest
        .spyOn(SavingsRepository.prototype, 'deleteById')
        .mockResolvedValue({ _id: 's1' } as never);

      const result = await new SavingsService().adminDeleteScheme('s1');

      expect(deleteSpy).toHaveBeenCalledWith('s1');
      expect(result).toEqual({ _id: 's1' });
    });

    it('rejects when the scheme does not exist', async () => {
      jest.spyOn(SavingsRepository.prototype, 'deleteById').mockResolvedValue(null);

      await expect(new SavingsService().adminDeleteScheme('missing')).rejects.toThrow(AppError);
    });
  });
});
