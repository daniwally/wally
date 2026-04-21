import { NextResponse } from "next/server";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { fetchRecentMails, type RawMail } from "@/lib/google";
import { extractExpense } from "@/lib/extractor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: accounts, error } = await supabase()
    .from("accounts")
    .select("id, account, oauth_refresh_token, last_scan_at")
    .eq("user_id", WALLY_USER_ID)
    .eq("type", "gmail")
    .eq("status", "ok");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const results: Array<{ account: string; scanned: number; detected: number; errors: string[] }> =
    [];

  for (const acc of accounts ?? []) {
    if (!acc.oauth_refresh_token) continue;

    const since = acc.last_scan_at
      ? Math.floor(new Date(acc.last_scan_at).getTime() / 1000)
      : Math.floor(now.getTime() / 1000) - 60 * 60 * 24;

    const errors: string[] = [];
    let mails: RawMail[] = [];
    try {
      mails = await fetchRecentMails(acc.oauth_refresh_token, since, 30);
    } catch (e) {
      errors.push(`fetch: ${e instanceof Error ? e.message : String(e)}`);
    }

    let detected = 0;

    for (const mail of mails) {
      const { data: existing } = await supabase()
        .from("expenses")
        .select("id")
        .eq("source_message_id", mail.id)
        .limit(1);

      if (existing && existing.length > 0) continue;

      try {
        const extracted = await extractExpense(mail);
        if (!extracted.is_expense || !extracted.amount || !extracted.provider) continue;

        const amountCents = Math.round(extracted.amount * 100);

        const { error: insertErr } = await supabase()
          .from("expenses")
          .insert({
            user_id: WALLY_USER_ID,
            account_id: acc.id,
            provider: extracted.provider,
            concept: extracted.concept,
            amount_cents: amountCents,
            currency: extracted.currency ?? "ARS",
            category_id: extracted.category,
            due_at: extracted.due_date,
            status: "pending_approval",
            confidence_provider: extracted.confidence,
            confidence_amount: extracted.confidence,
            confidence_due: extracted.confidence,
            source_message_id: mail.id,
            source_from: mail.from,
            raw_extract_json: extracted,
          });

        if (insertErr) {
          errors.push(`insert ${mail.id}: ${insertErr.message}`);
          continue;
        }
        detected++;
      } catch (e) {
        errors.push(`extract ${mail.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await supabase()
      .from("accounts")
      .update({ last_scan_at: now.toISOString() })
      .eq("id", acc.id);

    results.push({ account: acc.account, scanned: mails.length, detected, errors });
  }

  return NextResponse.json({ ok: true, results });
}
