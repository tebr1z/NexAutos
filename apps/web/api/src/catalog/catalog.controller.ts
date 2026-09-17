import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { CatalogCarDto } from './dto';
import { CatalogService } from './catalog.service';

const STAFF: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];

@Controller('catalog')
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @SkipThrottle()
  @Get()
  list() {
    return this.catalog.listPublished();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('manage')
  manage() {
    return this.catalog.listAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Post()
  create(@Body() dto: CatalogCarDto) {
    return this.catalog.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CatalogCarDto) {
    return this.catalog.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalog.remove(id);
  }
}
