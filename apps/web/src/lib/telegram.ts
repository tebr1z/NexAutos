export type TelegramLinkedAccount = {
  userId: string;
  telegramUserId: string;
  username: string | null;
  linkedAt: string;
};

export type TelegramStatus = {
  configured: boolean;
  enabled: boolean;
  botUsername: string | null;
  botName: string | null;
  encryptionReady: boolean;
  canManage: boolean;
  lastPollAt: string | null;
  lastError: string | null;
  linkedAccount: TelegramLinkedAccount | null;
  accounts?: (TelegramLinkedAccount & { name: string; email: string })[];
};

export type TelegramPair = { url: string; expiresAt: string };
export type TelegramConfig = { token?: string; enabled?: boolean; clear?: boolean };

export function telegramHealth(status: TelegramStatus | null, now: number) {
  if (!status) return { key: "loading", label: "Yoxlanılır", tone: "neutral" } as const;
  if (!status.configured) return { key: "setup", label: "Quraşdırılmayıb", tone: "neutral" } as const;
  if (!status.enabled) return { key: "paused", label: "Dayandırılıb", tone: "neutral" } as const;
  if (status.lastError) return { key: "error", label: "Bağlantı xətası", tone: "warning" } as const;
  if (!status.lastPollAt) return { key: "checking", label: "Bağlantı yoxlanılır", tone: "neutral" } as const;
  const lastPoll = Date.parse(status.lastPollAt);
  if (!Number.isFinite(lastPoll) || now - lastPoll > 90_000 || lastPoll - now > 30_000) {
    return { key: "stale", label: "Əlaqəni yoxlayın", tone: "warning" } as const;
  }
  return { key: "active", label: "Aktiv", tone: "success" } as const;
}

// The pairing URL grants access to operational customer data. Never render an
// arbitrary API-supplied URL as a link, or retain an expired grant in the UI.
export function safeTelegramPairUrl(pair: TelegramPair | null, botUsername: string | null | undefined, now: number) {
  if (!pair || !botUsername || !Number.isFinite(Date.parse(pair.expiresAt)) || Date.parse(pair.expiresAt) <= now) return null;
  const username = botUsername.replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) return null;
  try {
    const url = new URL(pair.url);
    const start = url.searchParams.get("start");
    if (url.protocol !== "https:" || url.hostname !== "t.me" || url.port || url.username || url.password || url.hash ||
        url.pathname.toLowerCase() !== `/${username}`.toLowerCase() || !start || !/^[a-zA-Z0-9_-]{1,64}$/.test(start) ||
        [...url.searchParams.keys()].length !== 1) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function telegramLinkPath(userId?: string) {
  if (userId === undefined) return "/telegram/link";
  if (typeof userId !== "string" || !userId.trim()) throw new Error("Telegram hesabı seçilməyib.");
  return `/telegram/link/${encodeURIComponent(userId.trim())}`;
}

export function telegramSafeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Əməliyyat tamamlanmadı. Yenidən cəhd edin.";
  // Backend errors are already sanitized; keep an additional boundary here so
  // a misconfigured proxy cannot echo a bot credential into the page.
  return message.replace(/\b\d{5,}:[A-Za-z0-9_-]{15,}\b/g, "[gizli token]").slice(0, 500);
}
