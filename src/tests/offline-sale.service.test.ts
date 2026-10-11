import { OfflineSaleService } from '../services/offlineSale.service';
import { PricingService } from '../services/pricing.service';
import { StockService } from '../services/stock.service';
import { OrderRepository } from '../repositories/order.repository';
import { UserRepository } from '../repositories/user.repository';

const breakdown = {
  items: [
    {
      product: '5', productGroupCode: 'RING', name: 'Silver Ring', weight: 4, quantity: 2, price: 1000, totalPrice: 2000,
      metalValue: 900, makingCharge: 100, wastage: 0, isGiftVoucher: false, stockAvailable: 10, basis: 'live' as const,
    },
  ],
  subtotal: 2000,
  taxableSubtotal: 2000,
  discount: 0,
  couponCode: null,
  gstPercent: 3,
  taxAmount: 60,
  deliveryZone: null,
  deliveryFee: 0,
  grandTotal: 2060,
  amountInPaise: 206000,
};

const sale = { items: [{ product: '5', quantity: 2 }], paymentMethod: 'UPI', saleLocation: ' Anna Nagar stall ' };

describe('OfflineSaleService', () => {
  let computeCheckout: jest.SpyInstance;
  let reserve: jest.SpyInstance;
  let release: jest.SpyInstance;
  let create: jest.SpyInstance;

  beforeEach(() => {
    computeCheckout = jest.spyOn(PricingService.prototype, 'computeCheckout').mockResolvedValue(breakdown as never);
    reserve = jest.spyOn(StockService.prototype, 'reserveForOrder').mockResolvedValue(undefined);
    release = jest.spyOn(StockService.prototype, 'releaseForOrder').mockResolvedValue(undefined);
    create = jest.spyOn(OrderRepository.prototype, 'create').mockResolvedValue({ _id: '77' } as never);
    jest.spyOn(OrderRepository.prototype, 'findById').mockResolvedValue({ _id: '77', invoiceNumber: 'INV-2026-000042' } as never);
    jest.spyOn(UserRepository.prototype, 'findByPhone').mockResolvedValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  it('prices without delivery, reduces stock and records a paid, delivered OFFLINE order for a walk-in', async () => {
    const order = await new OfflineSaleService().create('9', sale);

    expect(computeCheckout).toHaveBeenCalledWith({ items: sale.items, couponCode: null, address: null });
    expect(reserve).toHaveBeenCalledWith(breakdown.items, '9', 'Offline sale — Anna Nagar stall');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'OFFLINE',
        user: null,
        soldBy: '9',
        saleLocation: 'Anna Nagar stall',
        paymentMethod: 'upi',
        paymentStatus: 'Paid',
        status: 'Delivered',
        deliveryFee: 0,
        totalAmount: 2060,
        shippingAddress: expect.objectContaining({ name: 'Walk-in customer', phone: '' }),
      }),
    );
    expect(order).toMatchObject({ invoiceNumber: 'INV-2026-000042' });
  });

  it("links the sale to an existing customer by mobile, in any format", async () => {
    const findByPhone = jest
      .spyOn(UserRepository.prototype, 'findByPhone')
      .mockResolvedValue({ _id: '37', name: 'Vino' } as never);

    await new OfflineSaleService().create('9', { ...sale, customer: { phone: '+91 81908 58375' } });

    expect(findByPhone).toHaveBeenCalledWith('8190858375');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ user: '37', shippingAddress: expect.objectContaining({ name: 'Vino', phone: '8190858375' }) }),
    );
  });

  it('gives back the reserved stock if the order cannot be saved', async () => {
    create.mockRejectedValue(new Error('db down'));

    await expect(new OfflineSaleService().create('9', sale)).rejects.toThrow('db down');
    expect(release).toHaveBeenCalledWith(breakdown.items, '9');
  });

  it.each([
    [{ ...sale, paymentMethod: 'cod' }, 'paymentMethod must be one of cash, upi, card'],
    [{ ...sale, customer: { phone: '12345' } }, 'Customer mobile must be a valid 10-digit Indian mobile number'],
    [{ ...sale, items: [] }, 'Add at least one product'],
    [{ ...sale, items: [{ giftVoucherId: 'g1', isGiftVoucher: true }] }, 'Gift vouchers cannot be sold through in-store billing'],
  ])('rejects bad input without touching stock: %#', async (input, message) => {
    await expect(new OfflineSaleService().create('9', input)).rejects.toMatchObject({ statusCode: 400, message });
    expect(reserve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('quotes the same totals without saving anything', async () => {
    const quote = await new OfflineSaleService().quote({ items: sale.items, couponCode: 'DIWALI10' });

    expect(computeCheckout).toHaveBeenCalledWith({ items: sale.items, couponCode: 'DIWALI10', address: null });
    expect(quote).toMatchObject({ subtotal: 2000, taxAmount: 60, grandTotal: 2060, items: [{ name: 'Silver Ring', unitPrice: 1000 }] });
    expect(reserve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
