import { Module } from '@nestjs/common';
import { VinsController } from './vins.controller';
import { VinsService } from './vins.service';

@Module({
  controllers: [VinsController],
  providers: [VinsService],
})
export class VinsModule {}
