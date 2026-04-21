"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import type { ReactElement } from "react";

type NavTab = {
  href: string;
  label: string;
  icon: ReactElement;
  count?: number;
  section: "general" | "config";
};

export function Sidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();

  const tabs: NavTab[] = [
    { href: "/", label: "Dashboard", icon: <Icon.home />, section: "general" },
    {
      href: "/pendientes",
      label: "Pendientes",
      icon: <Icon.inbox />,
      count: pendingCount,
      section: "general",
    },
    { href: "/mail", label: "Parser de mails", icon: <Icon.mail />, section: "general" },
    { href: "/telegram", label: "Telegram", icon: <Icon.send />, section: "general" },
    { href: "/admin", label: "Cuentas & Reglas", icon: <Icon.settings />, section: "config" },
  ];

  const general = tabs.filter((t) => t.section === "general");
  const config = tabs.filter((t) => t.section === "config");

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href);

  return (
    <aside className="v2-sidebar">
      <Link href="/" className="v2-logo">
        <div className="v2-logo-mark">W</div>
        <div>
          <div>Wally</div>
          <div
            style={{
              fontSize: 10.5,
              color: "var(--text-3)",
              fontWeight: 400,
              letterSpacing: "0.02em",
            }}
          >
            gastos personales
          </div>
        </div>
      </Link>

      <div className="v2-nav-section">General</div>
      <div className="v2-nav">
        {general.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`v2-nav-item${isActive(t.href) ? " active" : ""}`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.count !== undefined && t.count > 0 && <span className="count">{t.count}</span>}
          </Link>
        ))}
      </div>

      <div className="v2-nav-section">Configuración</div>
      <div className="v2-nav">
        {config.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`v2-nav-item${isActive(t.href) ? " active" : ""}`}
          >
            {t.icon}
            <span>{t.label}</span>
          </Link>
        ))}
      </div>

      <div
        style={{
          marginTop: "auto",
          padding: "14px 10px 4px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          className="v2-avatar"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          W
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Wally</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>dora@wtf-agency.com</div>
        </div>
      </div>
    </aside>
  );
}
