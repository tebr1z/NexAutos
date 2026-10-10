import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { ShippingAccessGuard } from './shipping-access.guard';

@Module({
  controllers: [ShippingController],
  providers: [ShippingService, ShippingAccessGuard],
})
export class ShippingModule {}
