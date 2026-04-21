"use client";

import { useState, useMemo } from "react";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { fmtMoney } from "@/lib/format";
import { CAT_COLOR, CAT_ICON } from "@/components/Icon";

type ExpenseMin = {
  id: string;
  provider: string;
  concept: string | null;
  amount_cents: number;
  currency: string;
  category_id: string | null;
  paid_at: string | null;
};

type SortKey = "fecha" | "proveedor" | "categoria" | "monto";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  col,
  current,
  dir,
  onToggle,
  align = "left",
  width,
}: {
  label: string;
  col: SortKey;
  current: SortKey;
  dir: SortDir;
  onToggle: (c: SortKey) => void;
  align?: "left" | "right";
  width?: number;
}) {
  const isActive = current === col;
  return (
    <th
      style={{
        cursor: "pointer",
        userSelect: "none",
        textAlign: align,
        width,
      }}
      onClick={() => onToggle(col)}
    >
      <span
        style={{
          color: isActive ? "var(--text)" : "var(--text-3)",
          fontWeight: isActive ? 600 : 500,
        }}
      >
        {label}
        {isActive && (
          <span style={{ marginLeft: 4, fontSize: 10 }}>{dir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );
}

export function ExpensesTable({ expenses }: { expenses: ExpenseMin[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggle = (col: SortKey) => {
    if (col === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col);
      setSortDir(col === "monto" || col === "fecha" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...expenses];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "fecha":
          cmp =
            new Date(a.paid_at ?? 0).getTime() -
            new Date(b.paid_at ?? 0).getTime();
          break;
        case "proveedor":
          cmp = a.provider.localeCompare(b.provider, "es");
          break;
        case "categoria": {
          const ac = (a.category_id ?? "zzz") as CategoriaKey;
          const bc = (b.category_id ?? "zzz") as CategoriaKey;
          const al = CATEGORIAS[ac]?.label ?? "zzz";
          const bl = CATEGORIAS[bc]?.label ?? "zzz";
          cmp = al.localeCompare(bl, "es");
          break;
        }
        case "monto":
          cmp = a.amount_cents - b.amount_cents;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [expenses, sortKey, sortDir]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="v2-table">
        <thead>
          <tr>
            <SortHeader
              label="Fecha"
              col="fecha"
              current={sortKey}
              dir={sortDir}
              onToggle={toggle}
              width={70}
            />
            <SortHeader
              label="Proveedor"
              col="proveedor"
              current={sortKey}
              dir={sortDir}
              onToggle={toggle}
            />
            <th>Concepto</th>
            <SortHeader
              label="Categoría"
              col="categoria"
              current={sortKey}
              dir={sortDir}
              onToggle={toggle}
            />
            <SortHeader
              label="Monto"
              col="monto"
              current={sortKey}
              dir={sortDir}
              onToggle={toggle}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => {
            const cat = (e.category_id ?? "servicios") as CategoriaKey;
            const catInfo = CATEGORIAS[cat];
            const IconEl = CAT_ICON[cat] ?? CAT_ICON.servicios;
            const dateStr = e.paid_at
              ? new Date(e.paid_at).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                })
              : "—";
            return (
              <tr key={e.id}>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    color: "var(--text-3)",
                  }}
                >
                  {dateStr}
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      className="v2-avatar"
                      style={{
                        background: "var(--surface-2)",
                        color: CAT_COLOR[cat] ?? "#737373",
                        width: 26,
                        height: 26,
                      }}
                    >
                      <IconEl />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{e.provider}</span>
                  </div>
                </td>
                <td
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-2)",
                    maxWidth: 320,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.concept ?? "—"}
                </td>
                <td>
                  <span className="v2-badge">
                    <span
                      className="v2-cat-dot"
                      style={{ background: CAT_COLOR[cat] ?? "#737373" }}
                    />
                    {catInfo.label}
                  </span>
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtMoney(e.amount_cents / 100, e.currency as "ARS" | "USD")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
