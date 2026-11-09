import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { NotifyService } from '../notify/notify.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramConversationService } from './telegram-conversation.service';
import { TelegramMessagingService } from './telegram-messaging.service';
import { TelegramModule } from './telegram.module';

describe('Telegram module wiring', () => {
  it('resolves the real conversation/messaging/provider graph without contacting customers or the database', async () => {
    const outbound = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No outbound messages allowed in this test'));
    let moduleRef: TestingModule | undefined;
    try {
      moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule, TelegramModule],
      }).overrideProvider(PrismaService).useValue({
        telegramBotConfig: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }).compile();
      expect(moduleRef.get(TelegramConversationService)).toBeInstanceOf(TelegramConversationService);
      expect(moduleRef.get(TelegramMessagingService)).toBeInstanceOf(TelegramMessagingService);
      expect(moduleRef.get(NotifyService)).toBeInstanceOf(NotifyService);
      expect(outbound).not.toHaveBeenCalled();
    } finally {
      if (moduleRef) await moduleRef.close();
      outbound.mockRestore();
    }
  });
});
