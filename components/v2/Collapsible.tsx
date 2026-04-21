"use client";

import { useState, type ReactNode } from "react";

export function Collapsible({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "16px 20px",
          background: "transparent",
          border: "none",
          borderBottom: open ? "1px solid var(--border)" : "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--sans)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div>
          <div className="v2-card-title">{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {badge}
          <span
            style={{
              fontSize: 14,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.15s",
              color: "var(--text-3)",
            }}
          >
            ▾
          </span>
        </div>
      </button>
      {open && children}
    </>
  );
}
