"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import {
  extractManualExpense,
  extractAttachmentExpense,
  extractStatementItems,
  type ManualExtracted,
} from "@/lib/extractor";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { getSenderKey, applyLearnedCategory } from "@/lib/category-learning";

export async function payExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;

  // Si el expense tiene period_month (cualquier categoría con periodo mensual: tarjeta, cuota,
  // expensas, suscripción, etc.) → usar último día del periodo como paid_at
  // Así aparece en el mes correcto del dashboard (no en el mes en que se marcó pagado)
  const { data: expense } = await supabase()
    .from("expenses")
    .select("raw_extract_json")
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID)
    .single();

  type ExtractedMeta = { period_month?: string | null };
  const extracted = expense?.raw_extract_json as ExtractedMeta | null;
  const periodMonth = extracted?.period_month ?? null;

  const paidAt = periodMonth
    ? (() => {
        const [y, m] = periodMonth.split("-").map(Number);
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return new Date(Date.UTC(y, m - 1, lastDay, 12, 0, 0)).toISOString();
      })()
    : new Date().toISOString();

  await supabase()
    .from("expenses")
    .update({
      status: "paid",
      paid_at: paidAt,
      paid_via: periodMonth ? `Dashboard (periodo ${periodMonth})` : "Dashboard",
    })
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID);
  revalidatePath("/");
  revalidatePath("/mail");
  revalidatePath("/pendientes");
}

export async function ignoreExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase()
    .from("expenses")
    .update({ status: "ignored" })
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID);
  revalidatePath("/");
  revalidatePath("/mail");
}

const MAX_FILE_BYTES = 4 * 1024 * 1024;


function lastDayOfMonthISO(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, lastDay, 12, 0, 0)).toISOString();
}

function insertErrorRedirect(reason: string): never {
  redirect(`/nuevo?error=${encodeURIComponent(reason)}`);
}

export async function createManualExpense(formData: FormData): Promise<void> {
  const text = String(formData.get("text") || "").trim();
  const file = formData.get("file") as File | null;
  const hasFile = !!file && file.size > 0;

  if (!text && !hasFile) insertErrorRedirect("Mandá texto o archivo");

  let extracted: ManualExtracted;
  let source = "web";
  let attachment:
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
    | null = null;

  try {
    if (hasFile) {
      if (file!.size > MAX_FILE_BYTES) {
        insertErrorRedirect(`Archivo muy grande (max ${MAX_FILE_BYTES / 1024 / 1024}MB)`);
      }
      const buffer = Buffer.from(await file!.arrayBuffer());
      const base64 = buffer.toString("base64");
      const mime = file!.type;

      if (mime === "application/pdf") {
        source = "web PDF";
        attachment = {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        };
        extracted = await extractAttachmentExpense(attachment, text || undefined);
      } else if (
        mime === "image/jpeg" ||
        mime === "image/png" ||
        mime === "image/gif" ||
        mime === "image/webp"
      ) {
        source = "web foto";
        attachment = {
          type: "image",
          source: { type: "base64", media_type: mime, data: base64 },
        };
        extracted = await extractAttachmentExpense(attachment, text || undefined);
      } else {
        insertErrorRedirect(`Tipo no soportado: ${mime}`);
      }
    } else {
      source = "web texto";
      extracted = await extractManualExpense(text);
    }
  } catch (e) {
    insertErrorRedirect(e instanceof Error ? e.message : "error de extracción");
  }

  if (!extracted!.is_expense || !extracted!.amount || !extracted!.provider) {
    insertErrorRedirect(extracted!.reason || "no pude detectar un gasto");
  }

  const amountCents = Math.round(extracted!.amount! * 100);
  const currency = extracted!.currency ?? "ARS";
  const isPast = extracted!.intent === "past";

  // Prioridad para paid_at (si es past):
  // 1. period_month (último día del periodo) - resúmenes de tarjeta
  // 2. due_date explícita (fecha mencionada por usuario o vista en comprobante)
  // 3. ahora
  const paidAt = isPast
    ? extracted!.period_month
      ? lastDayOfMonthISO(extracted!.period_month)
      : extracted!.due_date
        ? new Date(extracted!.due_date + "T12:00:00Z").toISOString()
        : new Date().toISOString()
    : null;
  const dueAt = !isPast ? extracted!.due_date : null;

  // Aprendizaje: si el user ya corrigió la categoría para este provider antes,
  // usar la categoría aprendida en vez de la de Claude.
  const learnedCategory = await applyLearnedCategory(
    extracted!.category,
    null, // source_from para manual sin email
    extracted!.provider,
  );

  const category = (learnedCategory ?? extracted!.category ?? "servicios") as CategoriaKey;
  if (!CATEGORIAS[category]) {
    insertErrorRedirect(`categoría inválida: ${category}`);
  }

  const { data: insertedExpense, error: insertErr } = await supabase()
    .from("expenses")
    .insert({
      user_id: WALLY_USER_ID,
      provider: extracted!.provider,
      concept: extracted!.concept,
      amount_cents: amountCents,
      currency,
      category_id: category,
      due_at: dueAt,
      paid_at: paidAt,
      status: isPast ? "paid" : "pending_approval",
      paid_via: isPast ? `Web (${source})` : null,
      source_from: `web (${source})`,
      confidence_provider: 100,
      confidence_amount: 100,
      confidence_due: extracted!.due_date ? 90 : null,
      raw_extract_json: extracted!,
    })
    .select("id")
    .single();

  if (insertErr || !insertedExpense) insertErrorRedirect(insertErr?.message ?? "insert error");

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/mail");
  redirect(`/pendientes?ok=${encodeURIComponent(extracted!.provider)}`);
}

// ──────────────────────────────────────────
// Análisis-only (no crea expense, solo items)
// ──────────────────────────────────────────

function analysisErrorRedirect(reason: string): never {
  redirect(`/analisis?error=${encodeURIComponent(reason)}`);
}

type AnalysisAtt =
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        data: string;
      };
    }
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    };

async function analyzeSingleFile(
  file: File,
): Promise<{ provider: string; itemCount: number } | { error: string }> {
  if (file.size > MAX_FILE_BYTES) {
    return { error: `${file.name}: muy grande (max ${MAX_FILE_BYTES / 1024 / 1024}MB)` };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mime = file.type;

  let attachment: AnalysisAtt;
  if (mime === "application/pdf") {
    attachment = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  } else if (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/gif" ||
    mime === "image/webp"
  ) {
    attachment = {
      type: "image",
      source: { type: "base64", media_type: mime, data: base64 },
    };
  } else {
    return { error: `${file.name}: tipo no soportado (${mime})` };
  }

  try {
    const [metadata, extractedItems] = await Promise.all([
      extractAttachmentExpense(attachment, "Solo dame provider y period_month del resumen."),
      extractStatementItems(attachment),
    ]);
    const provider = metadata.provider ?? "Resumen";
    const period = metadata.period_month;

    if (extractedItems.length === 0) {
      return {
        error: `${file.name}: no detecté consumos (posiblemente saldo acreedor, resumen sin movimientos, o PDF no procesable)`,
      };
    }

    const batchId = crypto.randomUUID();
    const rows = extractedItems.map((it) => ({
      expense_id: null,
      user_id: WALLY_USER_ID,
      upload_batch_id: batchId,
      source_provider: provider,
      source_period: period,
      merchant: it.merchant,
      merchant_raw: it.merchant_raw,
      amount_cents: Math.round(it.amount * 100),
      currency: it.currency,
      purchase_date: it.purchase_date,
      cuota_numero: it.cuota_numero,
      cuota_total: it.cuota_total,
      category_id: it.category,
      merchant_type: it.merchant_type,
      is_essential: it.is_essential,
    }));

    const { error: insertErr } = await supabase().from("statement_items").insert(rows);
    if (insertErr) return { error: `${file.name}: ${insertErr.message}` };

    return { provider, itemCount: extractedItems.length };
  } catch (e) {
    return { error: `${file.name}: ${e instanceof Error ? e.message : "error"}` };
  }
}

export async function analyzeStatement(formData: FormData): Promise<void> {
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) analysisErrorRedirect("Subí al menos un archivo");

  // Procesa todos en paralelo
  const results = await Promise.all(files.map((f) => analyzeSingleFile(f)));

  const successes = results.filter(
    (r): r is { provider: string; itemCount: number } => !("error" in r),
  );
  const errors = results.filter((r): r is { error: string } => "error" in r);

  const totalItems = successes.reduce((s, r) => s + r.itemCount, 0);
  const summary = `${successes.length}/${files.length} resúmenes · ${totalItems} consumos`;

  revalidatePath("/analisis");

  if (errors.length > 0 && successes.length === 0) {
    analysisErrorRedirect(errors.map((e) => e.error).join(" · "));
  }

  if (errors.length > 0) {
    // Some succeeded, some failed — redirect with summary in ok + warning in error
    redirect(
      `/analisis?ok=${encodeURIComponent(summary)}&error=${encodeURIComponent(
        errors.map((e) => e.error).join(" · "),
      )}`,
    );
  }

  redirect(`/analisis?ok=${encodeURIComponent(summary)}`);
}

export async function deleteStatementBatch(formData: FormData) {
  const batchId = String(formData.get("batch_id") || "");
  if (!batchId) return;
  await supabase()
    .from("statement_items")
    .delete()
    .eq("upload_batch_id", batchId)
    .eq("user_id", WALLY_USER_ID);
  revalidatePath("/analisis");
}

export async function deleteAllStatements() {
  await supabase()
    .from("statement_items")
    .delete()
    .eq("user_id", WALLY_USER_ID);
  revalidatePath("/analisis");
}

export async function revertExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase()
    .from("expenses")
    .update({ status: "pending_approval", paid_at: null, paid_via: null })
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID);
  revalidatePath("/");
  revalidatePath("/mail");
  revalidatePath("/pendientes");
}

export async function changePaidAt(formData: FormData) {
  const id = String(formData.get("id") || "");
  const date = String(formData.get("date") || ""); // YYYY-MM-DD
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

  await supabase()
    .from("expenses")
    .update({
      paid_at: new Date(date + "T12:00:00Z").toISOString(),
      status: "paid",
      paid_via: "Dashboard (fecha manual)",
    })
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID);
  revalidatePath("/");
  revalidatePath("/mail");
  revalidatePath("/pendientes");
}

export async function changeCategory(formData: FormData) {
  const id = String(formData.get("id") || "");
  const category = String(formData.get("category") || "");
  if (!id || !category) return;
  if (!CATEGORIAS[category as CategoriaKey]) return;

  const { data: expense } = await supabase()
    .from("expenses")
    .select("source_from, provider")
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID)
    .single();

  await supabase()
    .from("expenses")
    .update({ category_id: category })
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID);

  // Aprendizaje: si este remitente/proveedor ya había sido corregido, actualizar la regla.
  // Si no existe, crear una nueva. Así futuros gastos del mismo origen se auto-clasifican.
  const senderKey = getSenderKey(expense?.source_from ?? null, expense?.provider ?? null);
  if (senderKey) {
    const { data: existingRule } = await supabase()
      .from("rules")
      .select("id")
      .eq("user_id", WALLY_USER_ID)
      .eq("sender_pattern", senderKey)
      .maybeSingle();

    if (existingRule) {
      await supabase()
        .from("rules")
        .update({ category_id: category })
        .eq("id", existingRule.id);
    } else {
      await supabase().from("rules").insert({
        user_id: WALLY_USER_ID,
        sender_pattern: senderKey,
        provider: expense?.provider ?? null,
        category_id: category,
        auto_approve: false,
        active: true,
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/mail");
  revalidatePath("/pendientes");
  revalidatePath("/admin");
}


export async function deleteExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase()
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID);
  revalidatePath("/");
  revalidatePath("/mail");
  revalidatePath("/pendientes");
}

export async function snoozeExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  const days = Number(formData.get("days") || 3);
  if (!id) return;
  await supabase()
    .from("expenses")
    .update({ status: "postponed" })
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID);
  await supabase()
    .from("reminders")
    .insert({ expense_id: id, fire_at: new Date(Date.now() + days * 86400000).toISOString() });
  revalidatePath("/");
  revalidatePath("/mail");
}
