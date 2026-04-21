"use client";

import { useState } from "react";
import { fmtARS } from "@/lib/format";
import { Icon } from "../Icon";

export type MerchantTypeAgg = {
  key: string;
  label: string;
  icon: string;
  total: number;
  count: number;
};

export type MerchantTypeItem = {
  id: string;
  merchant: string;
  merchant_type: string | null;
  amount_cents: number;
  currency: string;
  purchase_date: string | null;
  cuota_numero: number | null;
  cuota_total: number | null;
  source_provider: string | null;
  source_period: string | null;
};

export function MerchantTypeGrid({
  aggregates,
  items,
  totalArs,
}: {
  aggregates: MerchantTypeAgg[];
  items: MerchantTypeItem[];
  totalArs: number;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const expandedItems = expandedKey
    ? items
        .filter((it) => (it.merchant_type ?? "otros") === expandedKey && it.currency === "ARS")
        .sort((a, b) => b.amount_cents - a.amount_cents)
    : [];

  const expandedAgg = expandedKey ? aggregates.find((a) => a.key === expandedKey) : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 10,
      }}
    >
      {aggregates.map((mt) => {
        const pct = totalArs > 0 ? (mt.total / totalArs) * 100 : 0;
        const isExpanded = expandedKey === mt.key;
        return (
          <div key={mt.key} style={isExpanded ? { gridColumn: "1 / -1" } : undefined}>
            <button
              type="button"
              onClick={() => toggle(mt.key)}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: `1px solid ${isExpanded ? "var(--text)" : "var(--border)"}`,
                borderRadius: 10,
                background: isExpanded ? "var(--surface-2)" : "var(--surface)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--sans)",
                transition: "background 0.1s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15 }}>{mt.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{mt.label}</span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {mt.count} {mt.count === 1 ? "item" : "items"}
                  <span
                    style={{
                      display: "inline-block",
                      transform: isExpanded ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s",
                      fontSize: 10,
                    }}
                  >
                    ▾
                  </span>
                </span>
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                  marginBottom: 4,
                  color: "var(--text)",
                }}
              >
                {fmtARS(mt.total)}
              </div>
              <div className="v2-progress">
                <div
                  style={{
                    width: `${pct}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  marginTop: 2,
                  textAlign: "right",
                }}
              >
                {pct.toFixed(1)}% del total
              </div>
            </button>

            {/* Expandido: lista de items de esta categoría */}
            {isExpanded && expandedAgg && (
              <div
                style={{
                  marginTop: 8,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--surface)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 500,
                    }}
                  >
                    {expandedAgg.icon} {expandedAgg.label} · {expandedItems.length} consumos ·{" "}
                    {fmtARS(expandedAgg.total)}
                  </div>
                  <button
                    type="button"
                    className="v2-btn sm ghost"
                    onClick={() => setExpandedKey(null)}
                  >
                    <Icon.x /> Cerrar
                  </button>
                </div>

                <div style={{ maxHeight: 400, overflow: "auto" }}>
                  <table className="v2-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: 10 }}>Merchant</th>
                        <th style={{ fontSize: 10 }}>Fecha</th>
                        <th style={{ fontSize: 10 }}>Resumen</th>
                        <th style={{ textAlign: "right", fontSize: 10 }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expandedItems.map((it) => (
                        <tr key={it.id}>
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{it.merchant}</div>
                            {it.cuota_numero && it.cuota_total && (
                              <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                                cuota {it.cuota_numero}/{it.cuota_total}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              fontSize: 11,
                              color: "var(--text-3)",
                              fontFamily: "var(--mono)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {it.purchase_date
                              ? new Date(it.purchase_date + "T00:00").toLocaleDateString(
                                  "es-AR",
                                  { day: "2-digit", month: "2-digit" },
                                )
                              : "—"}
                          </td>
                          <td
                            style={{
                              fontSize: 11,
                              color: "var(--text-3)",
                            }}
                          >
                            {it.source_provider ?? "—"}{" "}
                            {it.source_period && (
                              <span
                                style={{
                                  fontFamily: "var(--mono)",
                                  color: "var(--text-4)",
                                }}
                              >
                                ({it.source_period})
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontSize: 12,
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 500,
                            }}
                          >
                            ${Math.round(it.amount_cents / 100).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
