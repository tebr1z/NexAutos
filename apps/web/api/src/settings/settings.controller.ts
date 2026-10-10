import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { FULL_ACCESS_ROLES } from '../common/access-roles';
import { AisKeyDto, CloudinarySettingsDto } from './dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...FULL_ACCESS_ROLES)
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

  @Get('cloudinary')
  cloudinary() {
    return this.settings.cloudinaryStatus();
  }

  @Put('cloudinary')
  saveCloudinary(@Body() dto: CloudinarySettingsDto) {
    return this.settings.saveCloudinary(dto);
  }

  @SkipThrottle()
  @Post('cloudinary/test')
  testCloudinary(@Body() dto: CloudinarySettingsDto) {
    return this.settings.testCloudinary(dto);
  }
}
