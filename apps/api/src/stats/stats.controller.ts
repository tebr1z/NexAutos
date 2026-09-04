import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('stats')
export class StatsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async dashboard() {
    const [totalOrders, activeShipments, delivered, revenue] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({
        where: { currentStatus: { notIn: ['DELIVERED', 'CANCELLED'] } },
      }),
      this.prisma.order.count({ where: { currentStatus: 'DELIVERED' } }),
      this.prisma.order.aggregate({ _sum: { amountUsd: true } }),
    ]);

    const pendingPayments = await this.prisma.invoice.count({ where: { status: 'issued' } });

    return {
      totalOrders,
      activeShipments,
      delivered,
      pendingPayments,
      revenue: Number(revenue._sum.amountUsd ?? 0),
    };
  }
}
