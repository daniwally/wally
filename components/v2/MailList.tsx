"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { fmtMoney } from "@/lib/format";
import { CAT_COLOR, Icon } from "@/components/Icon";

type Status = "pending_approval" | "paid" | "postponed" | "ignored" | "auto_approved";

type ExpenseMin = {
  id: string;
  provider: string;
  concept: string | null;
  amount_cents: number;
  currency: string;
  category_id: string | null;
  detected_at: string;
  status: string;
  source_from: string | null;
};

function statusChip(status: Status) {
  return {
    pending_approval: { cls: "red", label: "Aprobar" },
    paid: { cls: "green", label: "Pagado" },
    auto_approved: { cls: "green", label: "Auto" },
    postponed: { cls: "amber", label: "Pospuesto" },
    ignored: { cls: "", label: "Ignorado" },
  }[status];
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-AR");
}

export function MailList({
  expenses,
  filter,
  selectedId,
}: {
  expenses: ExpenseMin[];
  filter: string;
  selectedId: string | undefined;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return expenses;
    const q = query.toLowerCase().trim();
    return expenses.filter((e) => {
      return (
        e.provider.toLowerCase().includes(q) ||
        (e.concept ?? "").toLowerCase().includes(q) ||
        (e.source_from ?? "").toLowerCase().includes(q) ||
        String(e.amount_cents / 100).includes(q) ||
        (e.category_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [expenses, query]);

  return (
    <>
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "var(--surface-2)",
            borderRadius: 8,
            padding: "0 10px",
            border: "1px solid transparent",
          }}
        >
          <Icon.search />
          <input
            type="text"
            placeholder="Buscar por proveedor, concepto, remitente, monto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              padding: "7px 0",
              fontSize: 13,
              fontFamily: "var(--sans)",
              outline: "none",
              color: "var(--text)",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text-3)",
                cursor: "pointer",
                padding: 2,
                display: "flex",
              }}
              title="Limpiar"
            >
              <Icon.x />
            </button>
          )}
        </div>
        {query && (
          <span style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap" }}>
            {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: 30,
            color: "var(--text-3)",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {query ? `No hay resultados para "${query}"` : "No hay expenses en este filtro."}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="v2-table">
            <tbody>
              {filtered.map((e) => {
                const statusInfo = statusChip(e.status as Status);
                const cat = (e.category_id ?? "servicios") as CategoriaKey;
                const catInfo = CATEGORIAS[cat];
                const isSelected = selectedId === e.id;

                return (
                  <tr
                    key={e.id}
                    style={{
                      background: isSelected ? "var(--surface-2)" : "transparent",
                    }}
                  >
                    <td style={{ width: 20 }}>
                      <span
                        className="v2-cat-dot"
                        style={{ background: CAT_COLOR[cat] ?? "#737373" }}
                      />
                    </td>
                    <td>
                      <Link
                        href={`/mail?filter=${filter}&id=${e.id}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                        style={{
                          textDecoration: "none",
                          color: "var(--text)",
                          display: "block",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {e.provider}
                          {e.concept ? ` · ${e.concept}` : ""}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--text-3)",
                            marginTop: 2,
                            fontFamily: "var(--mono)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 320,
                          }}
                        >
                          {e.source_from ?? "—"}
                        </div>
                      </Link>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmtMoney(e.amount_cents / 100, e.currency as "ARS" | "USD")}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {catInfo.label}
                      </div>
                    </td>
                    <td style={{ width: 100 }}>
                      <span className={`v2-badge ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td style={{ width: 80, color: "var(--text-3)", fontSize: 12 }}>
                      {relativeTime(e.detected_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
