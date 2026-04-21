"use server";

import { revalidatePath } from "next/cache";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";

export async function addRule(formData: FormData) {
  const sender = String(formData.get("sender") || "").trim();
  const provider = String(formData.get("provider") || "").trim() || null;
  const categoryId = String(formData.get("category") || "servicios");
  const autoApprove = formData.get("auto_approve") === "on";

  if (!sender) return;

  await supabase()
    .from("rules")
    .insert({
      user_id: WALLY_USER_ID,
      sender_pattern: sender,
      provider,
      category_id: categoryId,
      auto_approve: autoApprove,
      active: true,
    });

  revalidatePath("/admin");
}

export async function removeRule(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase().from("rules").delete().eq("id", id).eq("user_id", WALLY_USER_ID);
  revalidatePath("/admin");
}

export async function setBudget(formData: FormData) {
  const categoryId = String(formData.get("category") || "");
  const amount = Number(formData.get("amount") || 0);

  if (!categoryId || !amount || amount <= 0) return;

  const amountCents = Math.round(amount * 100);

  const { data: existing } = await supabase()
    .from("budgets")
    .select("id")
    .eq("user_id", WALLY_USER_ID)
    .eq("category_id", categoryId)
    .eq("period", "month")
    .maybeSingle();

  if (existing) {
    await supabase()
      .from("budgets")
      .update({ amount_cents: amountCents })
      .eq("id", existing.id);
  } else {
    await supabase().from("budgets").insert({
      user_id: WALLY_USER_ID,
      category_id: categoryId,
      period: "month",
      amount_cents: amountCents,
      currency: "ARS",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function removeBudget(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase().from("budgets").delete().eq("id", id).eq("user_id", WALLY_USER_ID);
  revalidatePath("/admin");
}

export async function triggerScan() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET not set");

  const res = await fetch(`${appUrl}/api/cron/scan-mail`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const json = await res.json();
  revalidatePath("/admin");
  revalidatePath("/");
  return json;
}
