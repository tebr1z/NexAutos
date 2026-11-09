CREATE TABLE "TelegramBotConfig" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "tokenCiphertext" TEXT,
    "botId" TEXT,
    "botUsername" TEXT,
    "botName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cursor" BIGINT NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "lastPollAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramBotConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramAccount" (
    "userId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "chatId" TEXT,
    "username" TEXT,
    "pairingTokenHash" TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "conversation" JSONB,
    "linkedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "TelegramAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramAccount_telegramUserId_key" ON "TelegramAccount"("telegramUserId");
CREATE UNIQUE INDEX "TelegramAccount_pairingTokenHash_key" ON "TelegramAccount"("pairingTokenHash");
CREATE INDEX "TelegramAction_userId_state_idx" ON "TelegramAction"("userId", "state");
CREATE INDEX "TelegramAction_expiresAt_idx" ON "TelegramAction"("expiresAt");
ALTER TABLE "TelegramAccount" ADD CONSTRAINT "TelegramAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramAction" ADD CONSTRAINT "TelegramAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
