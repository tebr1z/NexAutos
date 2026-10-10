import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { MANAGEMENT_ROLES } from '../common/access-roles';
import { ShippingQuoteDto, ShippingRatesDto } from './dto';
import { ShippingService } from './shipping.service';
import { ShippingAccessGuard } from './shipping-access.guard';

@Controller('shipping')
export class ShippingController {
  constructor(private shipping: ShippingService) {}

  @SkipThrottle()
  @Get('meta')
  meta() {
    return this.shipping.meta();
  }

  @UseGuards(ShippingAccessGuard)
  @Post('quote')
  quote(@Body() dto: ShippingQuoteDto) {
    return this.shipping.quote(dto);
  }

  @UseGuards(ShippingAccessGuard)
  @SkipThrottle()
  @Get('catalog')
  catalog(@Query('auction') auction?: string, @Query('state') state?: string) {
    return this.shipping.catalog(auction, state);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  @Get('rates')
  rates() {
    return this.shipping.rates();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  @Put('rates')
  save(@Body() dto: ShippingRatesDto) {
    return this.shipping.saveRates(dto);
  }
}
