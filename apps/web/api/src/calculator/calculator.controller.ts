import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FULL_ACCESS_ROLES, INTERNAL_ROLES } from '../common/access-roles';
import { CalculatorService } from './calculator.service';
import { BugReportDto, BugStatusDto, CalculatorPlanDto, GlobalPricingDto, PricingDto } from './dto';

@Controller('calculator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...INTERNAL_ROLES)
export class CalculatorController {
  constructor(private calculator: CalculatorService) {}
  @Get('global-pricing') @Roles(...FULL_ACCESS_ROLES) globalPricing() { return this.calculator.globalPricing(); }
  @Patch('global-pricing') @Roles(...FULL_ACCESS_ROLES) saveGlobalPricing(@Body() dto: GlobalPricingDto) { return this.calculator.saveGlobalPricing(dto); }
  @Get('me') profile(@CurrentUser() user: { id: string }) { return this.calculator.profile(user.id); }
  @Patch('me') save(@CurrentUser() user: { id: string }, @Body() dto: PricingDto) { return this.calculator.save(user.id, dto); }
  @Post('reports') report(@CurrentUser() user: { id: string }, @Body() dto: BugReportDto) { return this.calculator.report(user.id, dto); }
  @Get('reports') @Roles(...FULL_ACCESS_ROLES) reports() { return this.calculator.reports(); }
  @Patch('reports/:id') @Roles(...FULL_ACCESS_ROLES) resolve(@Param('id') id: string, @Body() dto: BugStatusDto) { return this.calculator.resolve(id, dto.status); }
  @Get('users/:id') @Roles(...FULL_ACCESS_ROLES) account(@Param('id') id: string) { return this.calculator.profile(id); }
  @Patch('users/:id') @Roles(...FULL_ACCESS_ROLES) update(@Param('id') id: string, @Body() dto: CalculatorPlanDto, @CurrentUser() actor: { id: string; role: Role }) { return this.calculator.save(id, dto, actor); }
}
