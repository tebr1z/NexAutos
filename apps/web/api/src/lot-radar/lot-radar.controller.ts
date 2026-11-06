import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { FULL_ACCESS_ROLES } from '../common/access-roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BrowserBatchDto, CreateDealDto, CreateWatchDto, RadarPlanDto, ToggleWatchDto } from './dto';
import { LotRadarService } from './lot-radar.service';
@UseGuards(JwtAuthGuard)
@Controller('lot-radar')
export class LotRadarController {
  constructor(private radar: LotRadarService) {}
  @Get() list(@CurrentUser() u: { id: string }) { return this.radar.list(u.id); }
  @Get('inbox') inbox(@CurrentUser() u: { id: string }) { return this.radar.inbox(u.id); }
  @Get('plan') plan(@CurrentUser() u: { id: string }) { return this.radar.plan(u.id); }
  @UseGuards(RolesGuard) @Roles(...FULL_ACCESS_ROLES)
  @Get('admin/users/:userId') adminPlan(@Param('userId') id: string) { return this.radar.plan(id); }
  @UseGuards(RolesGuard) @Roles(...FULL_ACCESS_ROLES)
  @Patch('admin/users/:userId') savePlan(@Param('userId') id: string, @Body() dto: RadarPlanDto) { return this.radar.savePlan(id, dto); }
  @UseGuards(RolesGuard) @Roles(...FULL_ACCESS_ROLES)
  @Get('admin/deals') deals(@CurrentUser() u: { id: string }) { return this.radar.adminDeals(u.id); }
  @UseGuards(RolesGuard) @Roles(...FULL_ACCESS_ROLES)
  @Post('admin/deals') createDeal(@CurrentUser() u: { id: string }, @Body() dto: CreateDealDto) { return this.radar.createDeal(u.id, dto); }
  @UseGuards(RolesGuard) @Roles(...FULL_ACCESS_ROLES)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('admin/collector/next') collect(@CurrentUser() u: { id: string }) { return this.radar.collectNext(u.id); }
  @UseGuards(RolesGuard) @Roles(...FULL_ACCESS_ROLES)
  @Post('admin/collector/:id/finish') collected(@CurrentUser() u: { id: string }, @Param('id') id: string, @Body() dto: BrowserBatchDto) { return this.radar.finishCollected(u.id, id, dto); }
  @Post() create(@CurrentUser() u: { id: string }, @Body() dto: CreateWatchDto) { return this.radar.create(u.id, dto); }
  @Patch(':id') toggle(@CurrentUser() u: { id: string }, @Param('id') id: string, @Body() dto: ToggleWatchDto) { return this.radar.toggle(u.id, id, dto.enabled); }
  @Delete(':id') remove(@CurrentUser() u: { id: string }, @Param('id') id: string) { return this.radar.remove(u.id, id); }
  @Post('inbox/:id/read') read(@CurrentUser() u: { id: string }, @Param('id') id: string) { return this.radar.read(u.id, id); }
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(':id/check') check(@CurrentUser() u: { id: string }, @Param('id') id: string) { return this.radar.requestScan(u.id, id); }
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':id/browser') begin(@CurrentUser() u: { id: string }, @Param('id') id: string) { return this.radar.begin(u.id, id); }
  @Post(':id/browser/finish') finish(@CurrentUser() u: { id: string }, @Param('id') id: string, @Body() dto: BrowserBatchDto) { return this.radar.finish(u.id, id, dto); }
}
