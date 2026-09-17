import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";

@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  ping() {
    return { ok: true, service: "autonex-api", ts: new Date().toISOString() };
  }

  @Get("db")
  async db() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: true };
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "UNKNOWN";
      console.error("health/db", code, err instanceof Error ? err.message : err);
      return { ok: false, db: false, code, message: "Verilənlər bazası əlçatan deyil" };
    }
  }
}
