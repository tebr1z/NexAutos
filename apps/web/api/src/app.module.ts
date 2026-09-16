import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { VinsModule } from './vins/vins.module';
import { StatsModule } from './stats/stats.module';
import { TestimonialsModule } from './testimonials/testimonials.module';
import { CurrencyModule } from './currency/currency.module';
import { ContainersModule } from './containers/containers.module';
import { VesselsModule } from './vessels/vessels.module';
import { InquiriesModule } from './inquiries/inquiries.module';
import { ContractsModule } from './contracts/contracts.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 80 }] }),
    PrismaModule,
    AuthModule,
    OrdersModule,
    VinsModule,
    StatsModule,
    TestimonialsModule,
    CurrencyModule,
    ContainersModule,
    VesselsModule,
    InquiriesModule,
    ContractsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
