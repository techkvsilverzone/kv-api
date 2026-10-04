import { SavingsService } from '../services/savings.service';
import { SavingsRepository } from '../repositories/savings.repository';

const scheme = {
  _id: '9',
  userId: { _id: '37', name: 'Vino', email: 'vino@example.com', phone: '8190858375' },
  passbookNumber: 'SLV-0007',
  schemeType: 'SILVER_11_1',
  duration: 11,
  startDate: new Date('2026-01-05T00:00:00Z'),
  payments: [],
  status: 'Active',
};

describe('SavingsService.getByPassbookNumber', () => {
  beforeEach(() => {
    jest.spyOn(SavingsRepository.prototype, 'findByPassbookNumber').mockResolvedValue(scheme as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lets the owner open it, with their own name and mobile attached', async () => {
    const result = await new SavingsService().getByPassbookNumber('37', false, 'SLV-0007');
    expect(result.userId).toMatchObject({ name: 'Vino', phone: '8190858375' });
  });

  it('refuses another customer', async () => {
    await expect(new SavingsService().getByPassbookNumber('12', false, 'SLV-0007')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('lets staff open any passbook', async () => {
    await expect(new SavingsService().getByPassbookNumber('1', true, 'SLV-0007')).resolves.toMatchObject({ _id: '9' });
  });
});
