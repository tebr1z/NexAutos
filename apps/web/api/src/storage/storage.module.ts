import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { CloudinaryStorage } from './cloudinary.storage';

@Module({
  imports: [SettingsModule],
  providers: [CloudinaryStorage],
  exports: [CloudinaryStorage],
})
export class StorageModule {}
