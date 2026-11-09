import { TelegramApiError } from './telegram-http.service';
import { TelegramPollerService } from './telegram-poller.service';

function setup() {
  const row = { id: 'main', enabled: true, tokenCiphertext: 'encrypted-secret', cursor: 10n, botId: '123456' };
  const prisma = {
    telegramBotConfig: {
      findUnique: jest.fn().mockResolvedValue(row),
      findFirst: jest.fn().mockResolvedValue({ cursor: 12n, botId: '123456' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const config = { token: jest.fn().mockReturnValue('private-token') };
  const http = { call: jest.fn().mockResolvedValue([]) };
  const conversation = { handle: jest.fn().mockResolvedValue(undefined) };
  const service = new TelegramPollerService(prisma as never, config as never, http as never, conversation as never);
  const cycle = () => (service as unknown as { cycle(): Promise<number> }).cycle();
  return { row, prisma, config, http, conversation, service, cycle };
}

describe('Telegram polling lease and cursor', () => {
  it('does nothing for an unconfigured or disabled bot', async () => {
    const x = setup();
    x.prisma.telegramBotConfig.findUnique.mockResolvedValueOnce(null as never);
    expect(await x.cycle()).toBe(5000);
    x.row.enabled = false;
    expect(await x.cycle()).toBe(5000);
    expect(x.http.call).not.toHaveBeenCalled();
    expect(x.prisma.telegramBotConfig.updateMany).not.toHaveBeenCalled();
  });

  it('does not poll or handle anything owned by another worker', async () => {
    const x = setup();
    x.prisma.telegramBotConfig.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await x.cycle()).toBe(10000);
    expect(x.http.call).not.toHaveBeenCalled();
    expect(x.conversation.handle).not.toHaveBeenCalled();
  });

  it('refetches the cursor after winning the lease; successful polling alone marks health', async () => {
    const x = setup();
    await x.cycle();
    expect(x.http.call).toHaveBeenCalledWith('private-token', 'getUpdates', {
      offset: 12, timeout: 25, limit: 10, allowed_updates: ['message', 'callback_query'],
    }, expect.any(AbortSignal));
    expect(x.prisma.telegramBotConfig.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ enabled: true, tokenCiphertext: 'encrypted-secret' }),
      data: expect.objectContaining({ lastPollAt: expect.any(Date), lastError: null }),
    }));
  });

  it('fences out token replacements or disable operations during an outstanding poll', async () => {
    const x = setup();
    x.http.call.mockResolvedValue([{ update_id: 12 }]);
    x.prisma.telegramBotConfig.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await x.cycle();
    expect(x.conversation.handle).not.toHaveBeenCalled();
  });

  it('dispatches in ascending order, skips replayed ids and only advances the cursor monotonically', async () => {
    const x = setup();
    x.http.call.mockResolvedValue([{ update_id: 13 }, { update_id: 11 }, { update_id: 12 }, { update_id: 13 }]);
    await x.cycle();
    expect(x.conversation.handle.mock.calls.map(call => call[0])).toEqual([{ update_id: 12 }, { update_id: 13 }]);
    expect(x.conversation.handle).toHaveBeenCalledWith({ update_id: 12 }, 'private-token', '123456');
    const writes = x.prisma.telegramBotConfig.updateMany.mock.calls.map(call => call[0]).filter(call => call.data.cursor !== undefined);
    expect(writes.map(call => call.data.cursor)).toEqual([13n, 14n]);
    expect(writes[1].where.cursor).toEqual({ lte: 14n });
    expect(writes[1].where.leaseOwner).toEqual(expect.any(String));
  });

  it('an unanswerable update cannot poison the queue or automatically repeat a mutation', async () => {
    const x = setup();
    x.http.call.mockResolvedValue([{ update_id: 12 }, { update_id: 13 }]);
    x.conversation.handle.mockRejectedValueOnce(new Error('secret provider detail'));
    await x.cycle();
    expect(x.conversation.handle).toHaveBeenCalledTimes(2);
    expect(x.prisma.telegramBotConfig.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ cursor: 14n }) }));
  });

  it('obeys bounded Telegram retry_after without persisting secret provider details', async () => {
    const x = setup();
    x.http.call.mockRejectedValue(new TelegramApiError(429, 80));
    expect(await x.cycle()).toBe(80000);
    expect(x.prisma.telegramBotConfig.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { lastError: expect.stringContaining('Telegram sorğu limiti') } }));
    expect(x.conversation.handle).not.toHaveBeenCalled();
  });

  it('does not expose decrypt/fetch error messages', async () => {
    const x = setup();
    x.config.token.mockImplementation(() => { throw new Error('bot123456:super-secret'); });
    await x.cycle();
    const last = x.prisma.telegramBotConfig.updateMany.mock.calls.at(-1)?.[0];
    expect(last.data.lastError).not.toContain('super-secret');
    expect(last.data.lastPollAt).toBeUndefined();
  });

  it('refuses an invalid cursor before making an outbound request', async () => {
    const x = setup();
    x.prisma.telegramBotConfig.findFirst.mockResolvedValue({ cursor: -1n, botId: '123456' });
    await x.cycle();
    expect(x.http.call).not.toHaveBeenCalled();
  });

  it('shutdown releases only its own lease and aborts outstanding polling', async () => {
    const x = setup();
    await x.cycle();
    const signal = x.http.call.mock.calls[0][3] as AbortSignal;
    await x.service.onModuleDestroy();
    expect(signal.aborted).toBe(true);
    expect(x.prisma.telegramBotConfig.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'main', leaseOwner: expect.any(String) }, data: { leaseOwner: null, leaseUntil: null },
    });
    await x.cycle();
    expect(x.http.call).toHaveBeenCalledTimes(1);
  });
});
