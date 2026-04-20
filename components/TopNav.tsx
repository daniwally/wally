"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/telegram", label: "Telegram" },
  { href: "/mail", label: "Mail parser" },
  { href: "/admin", label: "Admin" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <div className="topbar">
      <div className="logo">
        <span className="logo-mark">W</span>
        <span>wally gastos</span>
      </div>
      <nav>
        <ul className="nav-tabs">
          {TABS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className={pathname === t.href ? "active" : ""}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="chip yellow">abril 2026</span>
      </div>
    </div>
  );
}
