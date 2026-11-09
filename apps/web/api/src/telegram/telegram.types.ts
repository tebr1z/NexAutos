export type TelegramUser = { id: number; is_bot?: boolean; username?: string };
export type TelegramMessage = {
  message_id: number;
  date?: number;
  from?: TelegramUser;
  chat: { id: number; type: string };
  text?: string;
};
export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: { id: string; from: TelegramUser; message?: TelegramMessage; data?: string };
};

export type TelegramIdentity = { id: number; is_bot: boolean; username?: string; first_name?: string };
