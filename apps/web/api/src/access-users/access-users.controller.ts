import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { AccessUsersService } from './access-users.service';
import { CreateFreightUserDto, UpdateFreightUserDto } from './dto';

const ADMINS: Role[] = ['SUPER_ADMIN', 'ADMIN'];

@Controller('access-users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMINS)
export class AccessUsersController {
  constructor(private users: AccessUsersService) {}

  @Get('freight')
  list() {
    return this.users.list();
  }

  @Post('freight')
  create(@Body() dto: CreateFreightUserDto) {
    return this.users.create(dto);
  }

  @Patch('freight/:id')
  update(@Param('id') id: string, @Body() dto: UpdateFreightUserDto) {
    return this.users.update(id, dto);
  }
}
