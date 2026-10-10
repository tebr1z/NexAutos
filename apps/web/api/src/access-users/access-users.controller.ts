import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FULL_ACCESS_ROLES } from '../common/access-roles';
import { AccessUsersService } from './access-users.service';
import { CreateAccessUserDto, UpdateAccessUserDto } from './dto';
import type { Role } from '@prisma/client';

@Controller('access-users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...FULL_ACCESS_ROLES)
export class AccessUsersController {
  constructor(private users: AccessUsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateAccessUserDto, @CurrentUser() user: { id: string; role: Role }) {
    return this.users.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccessUserDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.users.update(id, dto, user);
  }
}
