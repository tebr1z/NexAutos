import { Module } from '@nestjs/common';
import { CalculatorModule } from '../calculator/calculator.module';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { ShippingAccessGuard } from './shipping-access.guard';

@Module({
  imports: [CalculatorModule],
  controllers: [ShippingController],
  providers: [ShippingService, ShippingAccessGuard],
})
export class ShippingModule {}
