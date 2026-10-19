import { ForbiddenException } from '@nestjs/common';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { CalculatorService } from '../calculator/calculator.service';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

describe('Shipping access', () => {
  it('keeps rate tables and rate writes restricted to administrators', () => {
    for (const method of ['catalog', 'rates', 'overview', 'save'] as const) {
      expect(Reflect.getMetadata(ROLES_KEY, ShippingController.prototype[method])).toEqual(['SUPER_ADMIN', 'ADMIN']);
    }
  });
  it('checks expiry before fetching or calculating a lot', async () => {
    const shipping = { quote: jest.fn() };
    const calculator = { assertAccess: jest.fn().mockRejectedValue(new ForbiddenException('VexiraLabs ilə əlaqə qurun.')), finalize: jest.fn() };
    const controller = new ShippingController(shipping as unknown as ShippingService, calculator as unknown as CalculatorService);
    await expect(controller.quote({ priceUsd: 7000 }, { id: 'customer' })).rejects.toThrow('VexiraLabs');
    expect(calculator.assertAccess).toHaveBeenCalledWith('customer');
    expect(shipping.quote).not.toHaveBeenCalled();
    expect(calculator.finalize).not.toHaveBeenCalled();
  });
});
