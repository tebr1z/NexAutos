import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateStatusDto, UpdateVoyageDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const STAFF: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];

@Controller()
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get('tracking/:code')
  byCode(@Param('code') code: string) {
    return this.orders.findByCode(code);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('orders')
  list() {
    return this.orders.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Post('orders')
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: { id: string }) {
    return this.orders.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Post('orders/:id/container')
  attachContainer(
    @Param('id') id: string,
    @Body() body: { containerNumber: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.orders.attachContainer(id, body.containerNumber, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch('orders/:id/voyage')
  voyage(
    @Param('id') id: string,
    @Body() dto: UpdateVoyageDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.orders.updateVoyage(id, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch('orders/:id/status')
  status(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.orders.updateStatus(id, dto, user.id);
  }
}
