import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

import { ContainersModule } from '../containers/containers.module';
import { VesselsModule } from '../vessels/vessels.module';
import { NotifyModule } from '../notify/notify.module';
import { StorageModule } from '../storage/storage.module';
import { PhotoNotificationsService } from './photo-notifications.service';

@Module({
  imports: [ContainersModule, VesselsModule, NotifyModule, StorageModule],
  controllers: [OrdersController],
  providers: [OrdersService, PhotoNotificationsService],
  exports: [OrdersService],
})
export class OrdersModule {}
