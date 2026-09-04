import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateInquiryDto } from './dto';
import { InquiriesService } from './inquiries.service';

const STAFF: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];

@Controller('inquiries')
export class InquiriesController {
  constructor(private inquiries: InquiriesService) {}

  @SkipThrottle()
  @Post()
  create(@Body() dto: CreateInquiryDto) {
    return this.inquiries.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get()
  list() {
    return this.inquiries.list();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.inquiries.markRead(id);
  }
}
