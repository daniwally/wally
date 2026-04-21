import { NextResponse } from "next/server";
import { setWebhook, getWebhookInfo } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET not set" }, { status: 500 });
  }

  const url = `${appUrl}/api/telegram/webhook`;
  const result = await setWebhook(url, secret);
  const info = await getWebhookInfo();

  return NextResponse.json({ set: result, info });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const info = await getWebhookInfo();
  return NextResponse.json(info);
}
