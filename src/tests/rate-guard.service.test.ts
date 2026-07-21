import { RateGuardService } from '../services/rateGuard.service';
import { MetalRateRepository } from '../repositories/metalrate.repository';
import { RateStatusRepository } from '../repositories/rateStatus.repository';
import * as whatsapp from '../utils/whatsapp';

describe('RateGuardService.checkAndNotify (#25 B2)', () => {
  let reminderSpy: jest.SpyInstance;
  let successSpy: jest.SpyInstance;
  let setStatusSpy: jest.SpyInstance;

  beforeEach(() => {
    reminderSpy = jest
      .spyOn(whatsapp, 'sendRateUpdateReminder')
      .mockResolvedValue({ sent: true } as never);
    successSpy = jest
      .spyOn(whatsapp, 'sendRateUpdateSuccessNotice')
      .mockResolvedValue({ sent: true } as never);
    setStatusSpy = jest
      .spyOn(RateStatusRepository.prototype, 'setStatus')
      .mockImplementation(async (blocked, staleMetals, checkedAt) => ({
        blocked,
        staleMetals,
        checkedAt: (checkedAt ?? new Date()).toISOString(),
      }));
  });

  afterEach(() => jest.restoreAllMocks());

  it('blocks and notifies when both metals are missing today rate', async () => {
    jest.spyOn(MetalRateRepository.prototype, 'findLatest').mockResolvedValue(null);

    const status = await new RateGuardService().checkAndNotify();

    expect(status.blocked).toBe(true);
    expect(status.staleMetals).toEqual(['silver', 'gold']);
    expect(setStatusSpy).toHaveBeenCalledWith(true, ['silver', 'gold'], expect.any(Date));
    expect(reminderSpy).toHaveBeenCalledWith(['silver', 'gold']);
  });

  it('does not block when both metals have today rate (IST)', async () => {
    const now = new Date();
    jest
      .spyOn(MetalRateRepository.prototype, 'findLatest')
      .mockResolvedValue({ date: now } as never);

    const status = await new RateGuardService().checkAndNotify(now);

    expect(status.blocked).toBe(false);
    expect(status.staleMetals).toEqual([]);
    expect(reminderSpy).not.toHaveBeenCalled();
  });

  it('blocks only the stale metal when one is fresh', async () => {
    const now = new Date();
    const old = new Date('2000-01-01T00:00:00.000Z');
    jest
      .spyOn(MetalRateRepository.prototype, 'findLatest')
      .mockImplementation(async (metal) =>
        metal === 'SILVER' ? ({ date: now } as never) : ({ date: old } as never),
      );

    const status = await new RateGuardService().checkAndNotify(now);

    expect(status.blocked).toBe(true);
    expect(status.staleMetals).toEqual(['gold']);
    expect(reminderSpy).toHaveBeenCalledWith(['gold']);
  });

  it('is exempt on Sunday (IST), even with both metals missing today rate', async () => {
    // 2026-06-14T05:00:00Z = 10:30 IST on Sunday the 14th, past the 10:00 cutoff.
    const sunday = new Date('2026-06-14T05:00:00.000Z');
    const findLatestSpy = jest
      .spyOn(MetalRateRepository.prototype, 'findLatest')
      .mockResolvedValue(null);

    const status = await new RateGuardService().checkAndNotify(sunday, true);

    expect(status.blocked).toBe(false);
    expect(status.staleMetals).toEqual([]);
    expect(setStatusSpy).toHaveBeenCalledWith(false, [], sunday);
    expect(reminderSpy).not.toHaveBeenCalled();
    expect(successSpy).not.toHaveBeenCalled();
    expect(findLatestSpy).not.toHaveBeenCalled();
  });
});
