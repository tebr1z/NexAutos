import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { OPERATIONS_ROLES } from '../common/access-roles';
import { CreateInquiryDto } from './dto';
import { InquiriesService } from './inquiries.service';

@Controller('inquiries')
export class InquiriesController {
  constructor(private inquiries: InquiriesService) {}

  @SkipThrottle()
  @Post()
  create(@Body() dto: CreateInquiryDto) {
    return this.inquiries.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...OPERATIONS_ROLES)
  @Get()
  list() {
    return this.inquiries.list();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...OPERATIONS_ROLES)
  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.inquiries.markRead(id);
  }
}
