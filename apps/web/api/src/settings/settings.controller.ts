import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { AisKeyDto } from './dto';
import { SettingsService } from './settings.service';

const STAFF: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF)
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get('ais')
  ais() {
    return this.settings.aisStatus();
  }

  @Put('ais')
  saveAis(@Body() dto: AisKeyDto) {
    return this.settings.saveAisKey(dto.key);
  }

  @SkipThrottle()
  @Post('ais/test')
  testAis(@Body() dto: AisKeyDto) {
    return this.settings.testAis(dto.key);
  }
}
