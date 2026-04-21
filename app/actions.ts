"use server";

import { revalidatePath } from "next/cache";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";

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
