import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { R2Storage } from './r2.storage';

@Module({
  imports: [SettingsModule],
  providers: [R2Storage],
  exports: [R2Storage],
})
export class StorageModule {}
