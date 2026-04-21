import { NextResponse } from "next/server";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import {
  sendMessage,
  editMessageText,
  answerCallbackQuery,
  escapeMd,
  fmtARSForTg,
  fmtUSDForTg,
} from "@/lib/telegram";
import { extractManualExpense, extractAttachmentExpense, type ManualExtracted } from "@/lib/extractor";
import { downloadTelegramFile } from "@/lib/telegram";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

type TgPhotoSize = { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number };
type TgDocument = { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };

type TgMessage = {
  message_id: number;
  chat: { id: number };
  from: { id: number; username?: string; first_name?: string };
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: TgDocument;
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

  // Foto del comprobante
  if (msg.photo && msg.photo.length > 0) {
    await handleAttachment(
      chatId,
      msg.photo[msg.photo.length - 1].file_id,
      msg.caption,
      "image",
    );
    return;
  }

  // Documento (PDF o imagen como archivo)
  if (msg.document) {
    const mime = msg.document.mime_type ?? "";
    if (mime.startsWith("image/") || mime === "application/pdf") {
      await handleAttachment(chatId, msg.document.file_id, msg.caption, mime);
      return;
    }
    await sendMessage(
      chatId,
      `No puedo procesar tipo de archivo: ${escapeMd(mime)}\\. Mandame imagen o PDF\\.`,
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

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
      [
        "Soy el bot de *wally gastos* 🧾",
        "",
        "*Comandos:*",
        "• /status \\- pendientes de aprobar",
        "• /start \\- reconectar",
        "",
        "*Registrar gasto manual:*",
        "Escribime en lenguaje normal, ej:",
        "• _gasté 50 lucas en el super_",
        "• _pagué $12\\.000 de nafta_",
        "• _tengo que pagar 120k de luz el 25_",
        "• _aws USD 40_",
        "",
        "Lo paso por Claude Haiku y lo registro\\.",
      ].join("\n"),
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

  if (text.startsWith("/")) {
    await sendMessage(chatId, "No entendí ese comando. Probá /help");
    return;
  }

  // Texto libre → parsear como gasto manual con Claude
  try {
    const extracted = await extractManualExpense(text);
    await handleExtracted(chatId, extracted, "texto libre");
  } catch (e) {
    await sendMessage(chatId, `Error procesando: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

async function handleAttachment(
  chatId: number,
  fileId: string,
  caption: string | undefined,
  mimeHint: string,
) {
  try {
    await sendMessage(chatId, "🔍 Analizando imagen\\.\\.\\.", { parse_mode: "MarkdownV2" });

    const { buffer, mimeType, sizeBytes } = await downloadTelegramFile(fileId);

    const MAX_BYTES = 8 * 1024 * 1024;
    if (sizeBytes > MAX_BYTES) {
      await sendMessage(
        chatId,
        `Archivo muy grande (${Math.round(sizeBytes / 1024)}KB, max 8MB)`,
      );
      return;
    }

    const base64 = buffer.toString("base64");
    const effectiveMime = mimeType !== "application/octet-stream" ? mimeType : mimeHint;

    let extracted;
    if (effectiveMime === "application/pdf") {
      extracted = await extractAttachmentExpense(
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        },
        caption,
      );
    } else if (
      effectiveMime === "image/jpeg" ||
      effectiveMime === "image/png" ||
      effectiveMime === "image/gif" ||
      effectiveMime === "image/webp"
    ) {
      extracted = await extractAttachmentExpense(
        {
          type: "image",
          source: { type: "base64", media_type: effectiveMime, data: base64 },
        },
        caption,
      );
    } else {
      await sendMessage(chatId, `Tipo no soportado: ${escapeMd(effectiveMime)}`, {
        parse_mode: "MarkdownV2",
      });
      return;
    }

    await handleExtracted(chatId, extracted, effectiveMime === "application/pdf" ? "PDF" : "foto");
  } catch (e) {
    await sendMessage(chatId, `Error procesando: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

async function handleExtracted(
  chatId: number,
  extracted: ManualExtracted,
  source: string,
) {
  if (!extracted.is_expense || !extracted.amount || !extracted.provider) {
    await sendMessage(
      chatId,
      `No pude detectar un gasto${extracted.reason ? ": " + escapeMd(extracted.reason) : ""}`,
      { parse_mode: "MarkdownV2" },
    );
    return;
  }

  const amountCents = Math.round(extracted.amount * 100);
  const currency = extracted.currency ?? "ARS";
  const isPast = extracted.intent === "past";

  // Si es past con fecha explícita → usar esa fecha como paid_at
  // Si es past sin fecha → usar ahora
  // Si es future → date va a due_at, paid_at queda null
  const paidAt = isPast
    ? extracted.due_date
      ? new Date(extracted.due_date + "T12:00:00Z").toISOString()
      : new Date().toISOString()
    : null;
  const dueAt = !isPast ? extracted.due_date : null;

  const { data: inserted, error: insertErr } = await supabase()
    .from("expenses")
    .insert({
      user_id: WALLY_USER_ID,
      provider: extracted.provider,
      concept: extracted.concept,
      amount_cents: amountCents,
      currency,
      category_id: extracted.category,
      due_at: dueAt,
      paid_at: paidAt,
      status: isPast ? "paid" : "pending_approval",
      paid_via: isPast ? `Telegram (${source})` : null,
      source_from: `telegram (${source})`,
      confidence_provider: 100,
      confidence_amount: 100,
      confidence_due: extracted.due_date ? 90 : null,
      raw_extract_json: extracted,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    await sendMessage(chatId, `Error guardando: ${insertErr?.message ?? "?"}`);
    return;
  }

  const cat = (extracted.category ?? "servicios") as CategoriaKey;
  const catInfo = CATEGORIAS[cat];
  const amountStr =
    currency === "USD" ? fmtUSDForTg(extracted.amount) : fmtARSForTg(extracted.amount);

  const lines = [
    `${isPast ? "✅ Gasto registrado" : "⏰ Gasto futuro agendado"}`,
    "",
    `${catInfo.icon} *${escapeMd(extracted.provider)}*`,
    extracted.concept ? `_${escapeMd(extracted.concept)}_` : "",
    `💰 *${amountStr}* ${currency}`,
  ];
  if (extracted.due_date) {
    const dateLabel = isPast ? "Fecha" : "Vence";
    lines.push(`📅 ${dateLabel}: ${escapeMd(extracted.due_date)}`);
  }
  lines.push("", `_${escapeMd(catInfo.label)} · desde ${escapeMd(source)}_`);

  await sendMessage(chatId, lines.filter(Boolean).join("\n"), {
    parse_mode: "MarkdownV2",
    inline_keyboard: [[{ text: "🗑 Borrar", callback_data: `delete:${inserted.id}` }]],
  });
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

  if (action === "delete") {
    await supabase()
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .eq("user_id", WALLY_USER_ID);
    await editMessageText(chatId, messageId, (cb.message.text ?? "") + "\n\n🗑 Borrado");
    await answerCallbackQuery(cb.id, "🗑 Borrado");
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
