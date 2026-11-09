import { Body, Controller, Delete, Get, Header, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { FULL_ACCESS_ROLES, OPERATIONS_ROLES } from '../common/access-roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TelegramConfigDto } from './dto';
import { TelegramAccessService } from './telegram-access.service';
import { TelegramConfigService } from './telegram-config.service';

@Controller('telegram')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...OPERATIONS_ROLES)
export class TelegramController {
  constructor(private readonly config: TelegramConfigService, private readonly access: TelegramAccessService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  status(@CurrentUser() user: { id: string }) { return this.config.status(user.id); }

  @Put('config')
  @Roles(...FULL_ACCESS_ROLES)
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  save(@CurrentUser() user: { id: string }, @Body() dto: TelegramConfigDto) { return this.config.save(user.id, dto); }

  @Post('pair')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  pair(@CurrentUser() user: { id: string }) { return this.access.createPair(user.id); }

  @Delete('link')
  revokeSelf(@CurrentUser() user: { id: string }) { return this.access.revoke(user.id); }

  @Delete('link/:userId')
  @Roles(...FULL_ACCESS_ROLES)
  revoke(@CurrentUser() user: { id: string }, @Param('userId') target: string) { return this.access.revoke(user.id, target); }
}
