import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { MANAGEMENT_ROLES } from '../common/access-roles';
import { CatalogCarDto } from './dto';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @SkipThrottle()
  @Get()
  list() {
    return this.catalog.listPublished();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  @Get('manage')
  manage() {
    return this.catalog.listAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  @Post()
  create(@Body() dto: CatalogCarDto) {
    return this.catalog.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CatalogCarDto) {
    return this.catalog.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalog.remove(id);
  }
}
