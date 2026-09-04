import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      console.warn('Postgres unavailable — AIS and other live lookups still run; order/auth need the database.');
      console.warn(err instanceof Error ? err.message : err);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
