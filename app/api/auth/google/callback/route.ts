import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchUserEmail } from "@/lib/google";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return redirectAdmin(`error=${encodeURIComponent(error)}`);
  if (!code) return redirectAdmin("error=no_code");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("wally_oauth_state")?.value;
  if (!state || state !== savedState) return redirectAdmin("error=bad_state");

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchUserEmail(tokens.access_token!);

    const { error: insertError } = await supabase()
      .from("accounts")
      .insert({
        user_id: WALLY_USER_ID,
        type: "gmail",
        account: email ?? "unknown",
        oauth_refresh_token: tokens.refresh_token,
        status: "ok",
      });

    if (insertError) throw insertError;

    return redirectAdmin(`ok=${encodeURIComponent(email ?? "")}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return redirectAdmin(`error=${encodeURIComponent(msg)}`);
  }
}

function redirectAdmin(queryString: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/admin?${queryString}`);
}
