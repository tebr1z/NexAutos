import { Module } from '@nestjs/common';
import { CustomsController } from './customs.controller';
import { CustomsService } from './customs.service';

@Module({
  controllers: [CustomsController],
  providers: [CustomsService],
})
export class CustomsModule {}
