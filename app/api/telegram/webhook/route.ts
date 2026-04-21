import { NextResponse } from "next/server";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import {
  sendMessage,
  editMessageText,
  answerCallbackQuery,
  escapeMd,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

type TgMessage = {
  message_id: number;
  chat: { id: number };
  from: { id: number; username?: string; first_name?: string };
  text?: string;
};

type TgCallbackQuery = {
  id: string;
  from: { id: number };
  data?: string;
  message: { message_id: number; chat: { id: number }; text?: string };
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
};

export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update: TgUpdate = await req.json();

  try {
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query);
    }
  } catch (e) {
    console.error("telegram webhook error", e);
  }

  return NextResponse.json({ ok: true });
}

async function handleMessage(msg: TgMessage) {
  const text = msg.text?.trim() ?? "";
  const chatId = msg.chat.id;

  if (text === "/start" || text === "/connect") {
    await supabase()
      .from("users")
      .update({ telegram_chat_id: String(chatId) })
      .eq("id", WALLY_USER_ID);

    await sendMessage(
      chatId,
      [
        "👋 *Wally Gastos conectado*",
        "",
        "Te voy a avisar cuando detecte gastos nuevos en tu inbox\\.",
        "",
        "Comandos:",
        "• /start \\- reconectar",
        "• /status \\- ver pendientes",
        "• /help \\- ayuda",
      ].join("\n"),
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

  if (text === "/status") {
    const { data: pending } = await supabase()
      .from("expenses")
      .select("provider, concept, amount_cents, currency, due_at")
      .eq("user_id", WALLY_USER_ID)
      .eq("status", "pending_approval")
      .order("due_at", { ascending: true })
      .limit(10);

    if (!pending || pending.length === 0) {
      await sendMessage(chatId, "✨ No hay gastos pendientes");
      return;
    }

    const lines = pending.map((p) => {
      const amount =
        p.currency === "USD"
          ? `US$${(p.amount_cents / 100).toFixed(2)}`
          : `$${Math.round(p.amount_cents / 100).toLocaleString("es-AR")}`;
      const due = p.due_at ? ` · vence ${p.due_at}` : "";
      return `• *${escapeMd(p.provider)}* \\- ${escapeMd(amount)}${escapeMd(due)}`;
    });

    await sendMessage(
      chatId,
      `📋 *Pendientes \\(${pending.length}\\)*\n\n${lines.join("\n")}`,
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

  if (text === "/help") {
    await sendMessage(
      chatId,
      "Soy el bot de *wally gastos*\\. Comandos: /start /status /help",
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

  await sendMessage(chatId, "No entendí ese comando. Probá /help");
}

async function handleCallback(cb: TgCallbackQuery) {
  const data = cb.data ?? "";
  const [action, expenseId, extra] = data.split(":");
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;

  if (!expenseId) {
    await answerCallbackQuery(cb.id, "Inválido");
    return;
  }

  if (action === "pay") {
    await supabase()
      .from("expenses")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_via: "Telegram OK" })
      .eq("id", expenseId);

    await editMessageText(
      chatId,
      messageId,
      (cb.message.text ?? "") + "\n\n✅ Marcado como pagado",
    );
    await answerCallbackQuery(cb.id, "✅ Pagado");
    return;
  }

  if (action === "ignore") {
    await supabase().from("expenses").update({ status: "ignored" }).eq("id", expenseId);

    await editMessageText(
      chatId,
      messageId,
      (cb.message.text ?? "") + "\n\n🚫 Ignorado",
    );
    await answerCallbackQuery(cb.id, "🚫 Ignorado");
    return;
  }

  if (action === "snooze") {
    if (!extra) {
      // Show duration options
      const { sendMessage } = await import("@/lib/telegram");
      await sendMessage(chatId, "¿Por cuánto?", {
        inline_keyboard: [
          [
            { text: "1 día", callback_data: `snooze:${expenseId}:1` },
            { text: "3 días", callback_data: `snooze:${expenseId}:3` },
            { text: "1 semana", callback_data: `snooze:${expenseId}:7` },
          ],
        ],
      });
      await answerCallbackQuery(cb.id);
      return;
    }

    const days = parseInt(extra, 10);
    const fireAt = new Date(Date.now() + days * 86400000).toISOString();

    await supabase().from("expenses").update({ status: "postponed" }).eq("id", expenseId);
    await supabase().from("reminders").insert({ expense_id: expenseId, fire_at: fireAt });

    await editMessageText(
      chatId,
      messageId,
      (cb.message.text ?? "") + `\n\n⏰ Pospuesto ${days}d`,
    );
    await answerCallbackQuery(cb.id, `⏰ Pospuesto ${days}d`);
    return;
  }

  await answerCallbackQuery(cb.id, "Acción desconocida");
}
