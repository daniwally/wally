import { supabase, WALLY_USER_ID } from "./supabase";
import { sendMessage, escapeMd, fmtARSForTg, fmtUSDForTg } from "./telegram";
import { CATEGORIAS, type CategoriaKey } from "./mock-data";

export type ExpenseForNotification = {
  id: string;
  provider: string;
  concept: string | null;
  amount_cents: number;
  currency: "ARS" | "USD";
  category_id: string | null;
  due_at: string | null;
  source_from: string | null;
  confidence_amount: number | null;
};

export async function notifyNewExpense(expense: ExpenseForNotification) {
  const { data: user } = await supabase()
    .from("users")
    .select("telegram_chat_id")
    .eq("id", WALLY_USER_ID)
    .single();

  if (!user?.telegram_chat_id) return;

  const amount =
    expense.currency === "USD"
      ? fmtUSDForTg(expense.amount_cents / 100)
      : fmtARSForTg(expense.amount_cents / 100);

  const cat = (expense.category_id ?? "servicios") as CategoriaKey;
  const catInfo = CATEGORIAS[cat];

  const dueLine = expense.due_at
    ? `📅 *Vence:* ${escapeMd(formatDate(expense.due_at))}`
    : "";
  const fromLine = expense.source_from
    ? `📧 _${escapeMd(truncate(expense.source_from, 60))}_`
    : "";
  const confLine = expense.confidence_amount
    ? `🎯 Confianza: ${expense.confidence_amount}%`
    : "";

  const text = [
    `${catInfo.icon} *Nuevo gasto detectado*`,
    "",
    `*${escapeMd(expense.provider)}*`,
    expense.concept ? escapeMd(expense.concept) : "",
    `💰 *${amount}* ${expense.currency}`,
    dueLine,
    fromLine,
    confLine,
  ]
    .filter(Boolean)
    .join("\n");

  await sendMessage(user.telegram_chat_id, text, {
    parse_mode: "MarkdownV2",
    inline_keyboard: [
      [
        { text: "✅ Pagar", callback_data: `pay:${expense.id}` },
        { text: "⏰ Posponer", callback_data: `snooze:${expense.id}` },
      ],
      [{ text: "🚫 Ignorar", callback_data: `ignore:${expense.id}` }],
    ],
  });
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00");
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
