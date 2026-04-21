import { NextResponse } from "next/server";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { fetchMailsBySender } from "@/lib/google";
import { extractExpense } from "@/lib/extractor";
import { notifyNewExpense } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RuleResult = {
  sender: string;
  provider: string | null;
  matched: number;
  processed: number;
  detected: number;
  errors: string[];
};

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: accounts, error: accErr } = await supabase()
    .from("accounts")
    .select("id, account, oauth_refresh_token, last_scan_at")
    .eq("user_id", WALLY_USER_ID)
    .eq("type", "gmail")
    .eq("status", "ok");

  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

  const { data: rules, error: rulesErr } = await supabase()
    .from("rules")
    .select("id, sender_pattern, provider, category_id, auto_approve, hits")
    .eq("user_id", WALLY_USER_ID)
    .eq("active", true);

  if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 });

  if (!accounts?.length) {
    return NextResponse.json({ ok: true, message: "no accounts connected" });
  }
  if (!rules?.length) {
    return NextResponse.json({ ok: true, message: "no rules configured — add senders in /admin" });
  }

  const now = new Date();
  const accountResults: Array<{
    account: string;
    last_scan_since: string;
    rules: RuleResult[];
    total_detected: number;
  }> = [];

  for (const acc of accounts) {
    if (!acc.oauth_refresh_token) continue;

    const sinceSec = acc.last_scan_at
      ? Math.floor(new Date(acc.last_scan_at).getTime() / 1000)
      : Math.floor(now.getTime() / 1000) - 60 * 60 * 24 * 30;

    const ruleResults: RuleResult[] = [];
    let totalDetected = 0;

    for (const rule of rules) {
      const errors: string[] = [];
      let matched = 0;
      let processed = 0;
      let detected = 0;

      try {
        const mails = await fetchMailsBySender(
          acc.oauth_refresh_token,
          rule.sender_pattern,
          sinceSec,
        );
        matched = mails.length;

        for (const mail of mails) {
          const { data: existing } = await supabase()
            .from("expenses")
            .select("id")
            .eq("source_message_id", mail.id)
            .limit(1);
          if (existing && existing.length > 0) continue;

          processed++;

          try {
            const extracted = await extractExpense(mail);
            if (!extracted.is_expense || !extracted.amount) continue;

            const amountCents = Math.round(extracted.amount * 100);

            const status = rule.auto_approve ? "auto_approved" : "pending_approval";

            const { data: inserted, error: insertErr } = await supabase()
              .from("expenses")
              .insert({
                user_id: WALLY_USER_ID,
                account_id: acc.id,
                rule_id: rule.id,
                provider: extracted.provider ?? rule.provider ?? "Desconocido",
                concept: extracted.concept,
                amount_cents: amountCents,
                currency: extracted.currency ?? "ARS",
                category_id: extracted.category ?? rule.category_id,
                due_at: extracted.due_date,
                status,
                confidence_provider: extracted.confidence,
                confidence_amount: extracted.confidence,
                confidence_due: extracted.confidence,
                source_message_id: mail.id,
                source_from: mail.from,
                raw_extract_json: extracted,
              })
              .select("id")
              .single();

            if (insertErr || !inserted) {
              errors.push(`insert: ${insertErr?.message ?? "unknown"}`);
              continue;
            }
            detected++;
            totalDetected++;

            if (status === "pending_approval") {
              try {
                await notifyNewExpense({
                  id: inserted.id,
                  provider: extracted.provider ?? rule.provider ?? "Desconocido",
                  concept: extracted.concept,
                  amount_cents: amountCents,
                  currency: (extracted.currency ?? "ARS") as "ARS" | "USD",
                  category_id: extracted.category ?? rule.category_id,
                  due_at: extracted.due_date,
                  source_from: mail.from,
                  confidence_amount: extracted.confidence,
                });
              } catch (e) {
                errors.push(`notify: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          } catch (e) {
            errors.push(`extract: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        if (detected > 0) {
          await supabase()
            .from("rules")
            .update({ hits: (rule.hits ?? 0) + detected })
            .eq("id", rule.id);
        }
      } catch (e) {
        errors.push(`fetch: ${e instanceof Error ? e.message : String(e)}`);
      }

      ruleResults.push({
        sender: rule.sender_pattern,
        provider: rule.provider,
        matched,
        processed,
        detected,
        errors,
      });
    }

    await supabase()
      .from("accounts")
      .update({ last_scan_at: now.toISOString() })
      .eq("id", acc.id);

    accountResults.push({
      account: acc.account,
      last_scan_since: new Date(sinceSec * 1000).toISOString(),
      rules: ruleResults,
      total_detected: totalDetected,
    });
  }

  return NextResponse.json({ ok: true, accounts: accountResults });
}
