import { Module } from '@nestjs/common';
import { MarketSalesController } from './market-sales.controller';
import { MarketSalesService } from './market-sales.service';

@Module({ controllers: [MarketSalesController], providers: [MarketSalesService] })
export class MarketSalesModule {}
