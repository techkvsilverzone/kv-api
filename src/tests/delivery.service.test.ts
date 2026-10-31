import { DeliveryService, PincodeLookup } from '../services/delivery.service';
import { DeliveryConfigRepository } from '../repositories/deliveryConfig.repository';

const config = { getConfig: async () => ({ chennai: 150, otherDistrict: 200, otherState: 250 }) } as unknown as DeliveryConfigRepository;

describe('DeliveryService.checkPincode', () => {
  it('prices a real pincode by its delivery zone', async () => {
    const lookup: PincodeLookup = async (p) =>
      p === '600040' ? { district: 'Chennai', state: 'Tamil Nadu' } : { district: 'Madurai', state: 'Tamil Nadu' };
    const svc = new DeliveryService(lookup, config);
    expect(await svc.checkPincode('600040')).toMatchObject({
      available: true, verified: true, city: 'Chennai', deliveryZone: 'chennai', deliveryFee: 150, estimatedDays: '5-7',
    });
    expect(await svc.checkPincode('625001')).toMatchObject({ deliveryZone: 'otherDistrict', deliveryFee: 200 });
  });

  it('rejects a pincode the directory does not know, and remote areas without a lookup', async () => {
    const lookup = jest.fn<ReturnType<PincodeLookup>, Parameters<PincodeLookup>>(async () => null);
    const svc = new DeliveryService(lookup, config);
    expect(await svc.checkPincode('999999')).toMatchObject({ available: false, verified: true, reason: 'This pincode does not exist' });
    expect(await svc.checkPincode('744101')).toMatchObject({ available: false });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('stays available but unverified when the directory is down, and retries next time', async () => {
    const lookup = jest
      .fn<ReturnType<PincodeLookup>, Parameters<PincodeLookup>>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ district: 'Pune', state: 'Maharashtra' });
    const svc = new DeliveryService(lookup, config);
    expect(await svc.checkPincode('411001')).toEqual({ pincode: '411001', available: true, verified: false, estimatedDays: '5-7' });
    expect(await svc.checkPincode('411001')).toMatchObject({ verified: true, deliveryZone: 'otherState', deliveryFee: 250 });
  });

  it('caches definite answers for a day', async () => {
    let now = 0;
    const lookup = jest.fn<ReturnType<PincodeLookup>, Parameters<PincodeLookup>>(async () => ({ district: 'Chennai', state: 'Tamil Nadu' }));
    const svc = new DeliveryService(lookup, config, () => now);
    await svc.checkPincode('600040');
    await svc.checkPincode('600040');
    expect(lookup).toHaveBeenCalledTimes(1);
    now = 25 * 60 * 60 * 1000;
    await svc.checkPincode('600040');
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
