import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/TopNav";

export const metadata: Metadata = {
  title: "Wally Gastos",
  description: "Finanzas personales con parser de mails + Telegram bot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <div className="app">
          <TopNav />
          {children}
        </div>
      </body>
    </html>
  );
}
