import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { VesselsController } from './vessels.controller';
import { VesselsService } from './vessels.service';

@Module({
  imports: [SettingsModule],
  controllers: [VesselsController],
  providers: [VesselsService],
  exports: [VesselsService],
})
export class VesselsModule {}
