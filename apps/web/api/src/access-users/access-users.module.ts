import { Module } from '@nestjs/common';
import { AccessUsersController } from './access-users.controller';
import { AccessUsersService } from './access-users.service';

@Module({ controllers: [AccessUsersController], providers: [AccessUsersService] })
export class AccessUsersModule {}
