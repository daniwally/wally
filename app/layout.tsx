import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Wally Gastos",
  description: "Finanzas personales con parser de mails + Telegram bot",
};

export const dynamic = "force-dynamic";

async function getPendingCount() {
  try {
    const { count } = await supabase()
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", WALLY_USER_ID)
      .eq("status", "pending_approval");
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pendingCount = await getPendingCount();

  return (
    <html lang="es-AR">
      <body>
        <div className="v2-app">
          <Sidebar pendingCount={pendingCount} />
          <main className="v2-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
