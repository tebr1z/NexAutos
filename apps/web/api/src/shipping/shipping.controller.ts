import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { FULL_ACCESS_ROLES } from '../common/access-roles';
import { ShippingQuoteDto, ShippingRatesDto } from './dto';
import { ShippingService } from './shipping.service';
import { ShippingAccessGuard } from './shipping-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CalculatorService } from '../calculator/calculator.service';

@Controller('shipping')
export class ShippingController {
  constructor(private shipping: ShippingService, private calculator: CalculatorService) {}

  @SkipThrottle()
  @Get('meta')
  meta() {
    return this.shipping.meta();
  }

  @UseGuards(ShippingAccessGuard)
  @Post('quote')
  async quote(@Body() dto: ShippingQuoteDto, @CurrentUser() user?: { id: string }) {
    await this.calculator.assertAccess(user?.id);
    const quote = await this.shipping.quote(dto);
    return this.calculator.finalize(quote, user?.id, { url: dto.url?.split('?')[0], priceUsd: dto.priceUsd, auctionFeeUsd: quote.auctionFeeUsd, auction: quote.auction, yard: quote.yardSlug, state: quote.state, titleKind: dto.titleKind });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...FULL_ACCESS_ROLES)
  @SkipThrottle()
  @Get('catalog')
  catalog(@Query('auction') auction?: string, @Query('state') state?: string) {
    return this.shipping.catalog(auction, state);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...FULL_ACCESS_ROLES)
  @Get('rates')
  rates() {
    return this.shipping.rates();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...FULL_ACCESS_ROLES)
  @SkipThrottle()
  @Get('overview')
  overview() {
    return this.shipping.overview();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...FULL_ACCESS_ROLES)
  @Put('rates')
  save(@Body() dto: ShippingRatesDto) {
    return this.shipping.saveRates(dto);
  }
}
