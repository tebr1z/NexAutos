import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
      console.warn("Postgres unavailable — AIS and other live lookups still run; login/orders need the database.");
      console.warn(code || (err instanceof Error ? err.message : err));
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
