import { NextResponse } from "next/server";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { sendMessage, escapeMd, fmtARSForTg, fmtUSDForTg } from "@/lib/telegram";
import { notifyNewExpense } from "@/lib/notify";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabase()
    .from("users")
    .select("telegram_chat_id")
    .eq("id", WALLY_USER_ID)
    .single();

  if (!user?.telegram_chat_id) {
    return NextResponse.json({ ok: true, skipped: "no telegram_chat_id" });
  }

  const chatId = user.telegram_chat_id;

  const remindersFired = await processReminders(chatId);

  const digestSent = await sendDigest(chatId);

  return NextResponse.json({ ok: true, digestSent, remindersFired });
}

async function processReminders(chatId: string) {
  const now = new Date();

  const { data: reminders } = await supabase()
    .from("reminders")
    .select("id, expense_id, fire_at")
    .eq("fired", false)
    .lte("fire_at", now.toISOString());

  if (!reminders || reminders.length === 0) return 0;

  let fired = 0;
  for (const rem of reminders) {
    const { data: expense } = await supabase()
      .from("expenses")
      .select(
        "id, provider, concept, amount_cents, currency, category_id, due_at, source_from, confidence_amount, status",
      )
      .eq("id", rem.expense_id)
      .single();

    if (!expense) {
      await supabase().from("reminders").update({ fired: true }).eq("id", rem.id);
      continue;
    }

    if (expense.status !== "postponed") {
      await supabase().from("reminders").update({ fired: true }).eq("id", rem.id);
      continue;
    }

    await supabase()
      .from("expenses")
      .update({ status: "pending_approval" })
      .eq("id", expense.id);

    try {
      await sendMessage(chatId, "⏰ *Recordatorio pospuesto*", {
        parse_mode: "MarkdownV2",
      });
      await notifyNewExpense({
        id: expense.id,
        provider: expense.provider,
        concept: expense.concept,
        amount_cents: expense.amount_cents,
        currency: expense.currency as "ARS" | "USD",
        category_id: expense.category_id,
        due_at: expense.due_at,
        source_from: expense.source_from,
        confidence_amount: expense.confidence_amount,
      });
      fired++;
    } catch (e) {
      console.error("reminder notify error", e);
    }

    await supabase().from("reminders").update({ fired: true }).eq("id", rem.id);
  }

  return fired;
}

async function sendDigest(chatId: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const monthStart = new Date(Date.UTC(year, month, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString();
  const prevMonthStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const prevMonthEnd = monthStart;

  const [paidNowRes, paidPrevRes, pendingRes] = await Promise.all([
    supabase()
      .from("expenses")
      .select("amount_cents, currency")
      .eq("user_id", WALLY_USER_ID)
      .in("status", ["paid", "auto_approved"])
      .gte("paid_at", monthStart)
      .lt("paid_at", monthEnd),
    supabase()
      .from("expenses")
      .select("amount_cents, currency")
      .eq("user_id", WALLY_USER_ID)
      .in("status", ["paid", "auto_approved"])
      .gte("paid_at", prevMonthStart)
      .lt("paid_at", prevMonthEnd),
    supabase()
      .from("expenses")
      .select("id, provider, concept, amount_cents, currency, category_id, due_at")
      .eq("user_id", WALLY_USER_ID)
      .eq("status", "pending_approval")
      .order("due_at", { ascending: true, nullsFirst: false }),
  ]);

  const totalArsMes = (paidNowRes.data ?? [])
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + e.amount_cents / 100, 0);

  const totalArsPrev = (paidPrevRes.data ?? [])
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + e.amount_cents / 100, 0);

  const pendientes = pendingRes.data ?? [];
  const pendienteArs = pendientes
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + e.amount_cents / 100, 0);

  const delta =
    totalArsPrev > 0 ? Math.round(((totalArsMes - totalArsPrev) / totalArsPrev) * 100) : null;

  const urgentes = pendientes
    .filter((e) => e.due_at)
    .map((e) => ({
      ...e,
      diasHasta: Math.round(
        (new Date(e.due_at + "T00:00").getTime() - now.getTime()) / 86400000,
      ),
    }))
    .filter((e) => e.diasHasta <= 7)
    .slice(0, 3);

  const mesLabel = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const lines: string[] = [
    `☀️ *Buenos días, Wally*`,
    "",
    `📊 *${escapeMd(capitalize(mesLabel))}*`,
    `Gastado: *${fmtARSForTg(totalArsMes)}*`,
    `Pendiente aprobar: *${pendientes.length}* · ${fmtARSForTg(pendienteArs)}`,
  ];

  if (delta !== null) {
    const arrow = delta < 0 ? "↓" : "↑";
    lines.push(`${arrow} ${Math.abs(delta)}% vs mes anterior`);
  }

  if (urgentes.length > 0) {
    lines.push("", "⚠️ *Vencen esta semana:*");
    for (const u of urgentes) {
      const cat = (u.category_id ?? "servicios") as CategoriaKey;
      const catInfo = CATEGORIAS[cat];
      const amount =
        u.currency === "USD"
          ? fmtUSDForTg(u.amount_cents / 100)
          : fmtARSForTg(u.amount_cents / 100);
      const whenText =
        u.diasHasta === 0
          ? "hoy"
          : u.diasHasta < 0
            ? `hace ${Math.abs(u.diasHasta)}d`
            : `en ${u.diasHasta}d`;
      lines.push(`${catInfo.icon} *${escapeMd(u.provider)}* ${amount} · ${escapeMd(whenText)}`);
    }
  }

  lines.push("", `[Ver dashboard](https://wally.wtf-agency.works)`);

  await sendMessage(chatId, lines.join("\n"), { parse_mode: "MarkdownV2" });

  return { totalArsMes, pendienteArs, pendientesCount: pendientes.length, urgentesCount: urgentes.length };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
