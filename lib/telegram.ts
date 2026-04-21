const API_BASE = "https://api.telegram.org";

function botToken() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

type InlineKeyboard = InlineKeyboardButton[][];

export async function sendMessage(
  chatId: string | number,
  text: string,
  options: { parse_mode?: "MarkdownV2" | "HTML"; inline_keyboard?: InlineKeyboard } = {},
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode,
  };
  if (options.inline_keyboard) {
    body.reply_markup = { inline_keyboard: options.inline_keyboard };
  }

  const res = await fetch(`${API_BASE}/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram sendMessage: ${json.description}`);
  return json.result;
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  options: { parse_mode?: "MarkdownV2" | "HTML"; inline_keyboard?: InlineKeyboard } = {},
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options.parse_mode,
  };
  if (options.inline_keyboard) {
    body.reply_markup = { inline_keyboard: options.inline_keyboard };
  }
  const res = await fetch(`${API_BASE}/bot${botToken()}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram editMessageText: ${json.description}`);
  return json.result;
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const res = await fetch(`${API_BASE}/bot${botToken()}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
  return res.json();
}

export async function setWebhook(url: string, secretToken: string) {
  const res = await fetch(`${API_BASE}/bot${botToken()}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
  });
  return res.json();
}

export async function getWebhookInfo() {
  const res = await fetch(`${API_BASE}/bot${botToken()}/getWebhookInfo`);
  return res.json();
}

export async function downloadTelegramFile(
  fileId: string,
): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number }> {
  const token = botToken();

  const fileInfoRes = await fetch(`${API_BASE}/bot${token}/getFile?file_id=${fileId}`);
  const fileInfo = await fileInfoRes.json();
  if (!fileInfo.ok) throw new Error(`getFile: ${fileInfo.description}`);

  const filePath: string = fileInfo.result.file_path;

  const fileRes = await fetch(`${API_BASE}/file/bot${token}/${filePath}`);
  if (!fileRes.ok) throw new Error(`download failed: ${fileRes.status}`);
  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const mimeType =
    ({
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      pdf: "application/pdf",
    } as Record<string, string>)[ext] ?? "application/octet-stream";

  return { buffer, mimeType, sizeBytes: buffer.byteLength };
}

// MarkdownV2 escape — Telegram exige escape de caracteres especiales
export function escapeMd(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

export function fmtARSForTg(n: number): string {
  return "\\$" + Math.round(n).toLocaleString("es-AR").replace(/\./g, "\\.");
}

export function fmtUSDForTg(n: number): string {
  return "US\\$" + n.toFixed(2).replace(".", "\\.");
}
