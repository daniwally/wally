import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/google";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const url = buildAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set("wally_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
