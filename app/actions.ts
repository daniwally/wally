"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import {
  extractManualExpense,
  extractAttachmentExpense,
  type ManualExtracted,
} from "@/lib/extractor";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";

export async function payExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase()
    .from("expenses")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_via: "Dashboard",
    })
    .eq("id", id)
    .eq("user_id", WALLY_USER_ID);
  revalidatePath("/");
  revalidatePath("/mail");
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
        extracted = await extractAttachmentExpense(
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          text || undefined,
        );
      } else if (
        mime === "image/jpeg" ||
        mime === "image/png" ||
        mime === "image/gif" ||
        mime === "image/webp"
      ) {
        source = "web foto";
        extracted = await extractAttachmentExpense(
          {
            type: "image",
            source: { type: "base64", media_type: mime, data: base64 },
          },
          text || undefined,
        );
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
  const paidAt = isPast
    ? extracted!.due_date
      ? new Date(extracted!.due_date + "T12:00:00Z").toISOString()
      : new Date().toISOString()
    : null;
  const dueAt = !isPast ? extracted!.due_date : null;

  const category = (extracted!.category ?? "servicios") as CategoriaKey;
  // validate category
  if (!CATEGORIAS[category]) {
    insertErrorRedirect(`categoría inválida: ${category}`);
  }

  const { error: insertErr } = await supabase()
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
    });

  if (insertErr) insertErrorRedirect(insertErr.message);

  revalidatePath("/");
  revalidatePath("/pendientes");
  revalidatePath("/mail");
  redirect(`/pendientes?ok=${encodeURIComponent(extracted!.provider)}`);
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
