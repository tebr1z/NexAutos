import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { MANAGEMENT_ROLES } from '../common/access-roles';
import { MarketSaleBatchDto, MarketSaleQueryDto } from './dto';
import { MarketSalesService } from './market-sales.service';

@Controller('market-sales')
export class MarketSalesController {
  constructor(private market: MarketSalesService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('ingest')
  ingest(@Headers('x-autonex-collector') key: string | undefined, @Body() dto: MarketSaleBatchDto) {
    return this.market.ingest(key, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGEMENT_ROLES, 'FREIGHT_USER')
  @Get('manage')
  list(@Query() query: MarketSaleQueryDto) {
    return this.market.list(query);
  }
}
