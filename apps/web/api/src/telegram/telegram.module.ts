import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { NotifyModule } from '../notify/notify.module';
import { TelegramAccessService } from './telegram-access.service';
import { TelegramActionsService } from './telegram-actions.service';
import { TelegramConfigService } from './telegram-config.service';
import { TelegramConversationService } from './telegram-conversation.service';
import { TelegramController } from './telegram.controller';
import { TelegramHttpService } from './telegram-http.service';
import { TelegramPollerService } from './telegram-poller.service';
import { TelegramMessagingService } from './telegram-messaging.service';

@Module({
  imports: [OrdersModule, NotifyModule],
  controllers: [TelegramController],
  providers: [TelegramAccessService, TelegramActionsService, TelegramConfigService, TelegramConversationService, TelegramHttpService, TelegramPollerService, TelegramMessagingService],
})
export class TelegramModule {}
