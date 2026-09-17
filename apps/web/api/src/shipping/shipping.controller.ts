import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { ShippingQuoteDto, ShippingRatesDto } from './dto';
import { ShippingService } from './shipping.service';

const STAFF: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];

@Controller('shipping')
export class ShippingController {
  constructor(private shipping: ShippingService) {}

  @SkipThrottle()
  @Get('meta')
  meta() {
    return this.shipping.meta();
  }

  @Post('quote')
  quote(@Body() dto: ShippingQuoteDto) {
    return this.shipping.quote(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('rates')
  rates() {
    return this.shipping.rates();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Put('rates')
  save(@Body() dto: ShippingRatesDto) {
    return this.shipping.saveRates(dto);
  }
}
