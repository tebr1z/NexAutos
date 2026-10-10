import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { ShippingQuoteDto, ShippingRatesDto } from './dto';
import { ShippingService } from './shipping.service';
import { ShippingAccessGuard } from './shipping-access.guard';

const STAFF: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];

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
