import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { TelegramAccessService } from './telegram-access.service';
import { TelegramActionsService } from './telegram-actions.service';
import { TelegramConfigService } from './telegram-config.service';
import { TelegramConversationService } from './telegram-conversation.service';
import { TelegramController } from './telegram.controller';
import { TelegramHttpService } from './telegram-http.service';
import { TelegramPollerService } from './telegram-poller.service';

@Module({
  imports: [OrdersModule],
  controllers: [TelegramController],
  providers: [TelegramAccessService, TelegramActionsService, TelegramConfigService, TelegramConversationService, TelegramHttpService, TelegramPollerService],
})
export class TelegramModule {}
