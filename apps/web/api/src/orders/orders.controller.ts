import { Body, Controller, Get, Header, Param, Patch, Post, Put, StreamableFile, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateInsuranceDto, CreateOrderDto, CustomerSmsDto, OrderPhotoDto, PrunePhotosDto, UpdateInsuranceDto, UpdateStatusDto, UpdateVoyageDto } from './dto';
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
  @Post('insurance')
  createInsurance(@Body() dto: CreateInsuranceDto, @CurrentUser() user: { id: string }) {
    return this.orders.createInsuranceCase(dto, user.id);
  }

  @Get('insurance/receipt/:token')
  insuranceReceipt(@Param('token') token: string) {
    return this.orders.findInsuranceReceipt(token);
  }

  @Get('insurance/:code')
  insuranceByCode(@Param('code') code: string) {
    return this.orders.findInsuranceByCode(code);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('orders')
  list() {
    return this.orders.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/mine')
  mine(@CurrentUser() user: { id: string }) {
    return this.orders.findMine(user.id);
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
  @Post('orders/:id/sms')
  sms(
    @Param('id') id: string,
    @Body() dto: CustomerSmsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.orders.sendCustomerSms(id, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch('orders/:id/insurance')
  insurance(
    @Param('id') id: string,
    @Body() dto: UpdateInsuranceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.orders.updateInsurance(id, dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Post('orders/:id/insurance/payout')
  insurancePayout(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.orders.confirmInsurancePayout(id, user.id);
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

  @SkipThrottle()
  @Get('media/photos/:id')
  @Header('Cache-Control', 'public, max-age=86400, immutable')
  async photo(@Param('id') id: string) {
    const file = await this.orders.photoBinary(id);
    return new StreamableFile(file.buf, { type: file.mime });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Post('orders/:id/photos')
  addPhoto(@Param('id') id: string, @Body() dto: OrderPhotoDto) {
    return this.orders.addPhoto(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Put('orders/:id/photos')
  prunePhotos(@Param('id') id: string, @Body() dto: PrunePhotosDto) {
    return this.orders.prunePhotos(id, dto.keepIds ?? [], dto.keepUrls ?? []);
  }
}
