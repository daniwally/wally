import { NextResponse } from "next/server";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { fetchMailsBySender, fetchGeneralInbox } from "@/lib/google";
import { extractExpense } from "@/lib/extractor";
import { notifyNewExpense } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Given "YYYY-MM" returns ISO timestamp of the last day of that month at 12:00 UTC
function lastDayOfMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last of this
  return new Date(Date.UTC(y, m - 1, lastDay.getUTCDate(), 12, 0, 0)).toISOString();
}

type RuleResult = {
  sender: string;
  provider: string | null;
  matched: number;
  processed: number;
  detected: number;
  errors: string[];
};

type GeneralResult = {
  matched: number;
  processed: number;
  detected: number;
  skipped_known: number;
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
  const now = new Date();
  const accountResults: Array<{
    account: string;
    last_scan_since: string;
    rules: RuleResult[];
    general: GeneralResult;
    total_detected: number;
  }> = [];

  for (const acc of accounts) {
    if (!acc.oauth_refresh_token) continue;

    const sinceSec = acc.last_scan_at
      ? Math.floor(new Date(acc.last_scan_at).getTime() / 1000)
      : Math.floor(now.getTime() / 1000) - 60 * 60 * 24 * 30;

    const ruleResults: RuleResult[] = [];
    let totalDetected = 0;

    for (const rule of rules ?? []) {
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

            // Si tiene period_month (tarjeta/cuota/expensas/suscripcion con mes explicito)
            // y es auto_approved, usar último día del periodo como paid_at
            const paidAtForCard =
              status === "auto_approved" && extracted.period_month
                ? lastDayOfMonth(extracted.period_month)
                : null;

            const { data: inserted, error: insertErr } = await supabase()
              .from("expenses")
              .insert({
                user_id: WALLY_USER_ID,
                account_id: acc.id,
                rule_id: rule.id,
                provider: extracted.provider ?? rule.provider ?? "Desconocido",
                concept: extracted.concept,
                paid_at: paidAtForCard,
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

    // Segunda pasada: inbox general con keywords financieros
    const generalResult: GeneralResult = {
      matched: 0,
      processed: 0,
      detected: 0,
      skipped_known: 0,
      errors: [],
    };

    try {
      const generalMails = await fetchGeneralInbox(acc.oauth_refresh_token, sinceSec, 25);
      generalResult.matched = generalMails.length;

      for (const mail of generalMails) {
        const { data: existing } = await supabase()
          .from("expenses")
          .select("id")
          .eq("source_message_id", mail.id)
          .limit(1);
        if (existing && existing.length > 0) {
          generalResult.skipped_known++;
          continue;
        }

        generalResult.processed++;

        try {
          const extracted = await extractExpense(mail);
          if (!extracted.is_expense || !extracted.amount) continue;

          const amountCents = Math.round(extracted.amount * 100);

          const { data: inserted, error: insertErr } = await supabase()
            .from("expenses")
            .insert({
              user_id: WALLY_USER_ID,
              account_id: acc.id,
              rule_id: null,
              provider: extracted.provider ?? "Desconocido",
              concept: extracted.concept,
              paid_at: null,
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
            })
            .select("id")
            .single();

          if (insertErr || !inserted) {
            generalResult.errors.push(`insert: ${insertErr?.message ?? "unknown"}`);
            continue;
          }
          generalResult.detected++;
          totalDetected++;

          try {
            await notifyNewExpense({
              id: inserted.id,
              provider: extracted.provider ?? "Desconocido",
              concept: extracted.concept,
              amount_cents: amountCents,
              currency: (extracted.currency ?? "ARS") as "ARS" | "USD",
              category_id: extracted.category,
              due_at: extracted.due_date,
              source_from: mail.from,
              confidence_amount: extracted.confidence,
            });
          } catch (e) {
            generalResult.errors.push(
              `notify: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        } catch (e) {
          generalResult.errors.push(
            `extract: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    } catch (e) {
      generalResult.errors.push(`fetch: ${e instanceof Error ? e.message : String(e)}`);
    }

    await supabase()
      .from("accounts")
      .update({ last_scan_at: now.toISOString() })
      .eq("id", acc.id);

    accountResults.push({
      account: acc.account,
      last_scan_since: new Date(sinceSec * 1000).toISOString(),
      rules: ruleResults,
      general: generalResult,
      total_detected: totalDetected,
    });
  }

  return NextResponse.json({ ok: true, accounts: accountResults });
}
