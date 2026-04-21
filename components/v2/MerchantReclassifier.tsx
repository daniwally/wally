"use client";

import { useState, useMemo, useTransition } from "react";
import { fmtARS } from "@/lib/format";
import { Icon } from "../Icon";
import { MERCHANT_TYPE_META } from "@/lib/extractor";
import { reclassifyMerchant, rebuildStatementItemsClassification } from "@/app/actions";

type ItemMin = {
  id: string;
  merchant: string;
  merchant_type: string | null;
  amount_cents: number;
  currency: string;
};

type CustomType = {
  slug: string;
  label: string;
  icon: string | null;
};

export function MerchantReclassifier({
  items,
  customTypes = [],
}: {
  items: ItemMin[];
  customTypes?: CustomType[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isRebuilding, startRebuild] = useTransition();
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);

  const handleRebuild = () => {
    startRebuild(async () => {
      const result = await rebuildStatementItemsClassification();
      if (result.error) {
        setRebuildResult(`❌ Error: ${result.error}`);
      } else {
        setRebuildResult(
          `✅ ${result.updated} merchants reclasificados de ${result.total} analizados`,
        );
      }
      setTimeout(() => setRebuildResult(null), 5000);
    });
  };

  // Agrupar por merchant
  const merchants = useMemo(() => {
    const map = new Map<
      string,
      { merchant: string; currentType: string | null; total: number; count: number }
    >();
    items
      .filter((i) => i.currency === "ARS")
      .forEach((it) => {
        const existing = map.get(it.merchant);
        if (existing) {
          existing.total += it.amount_cents / 100;
          existing.count++;
        } else {
          map.set(it.merchant, {
            merchant: it.merchant,
            currentType: it.merchant_type,
            total: it.amount_cents / 100,
            count: 1,
          });
        }
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [items]);

  const filtered = search
    ? merchants.filter((m) => m.merchant.toLowerCase().includes(search.toLowerCase()))
    : merchants;

  const merchantTypeOptions = [
    ...Object.entries(MERCHANT_TYPE_META).map(([k, v]) => ({
      value: k,
      label: `${v.icon} ${v.label}`,
    })),
    ...customTypes.map((c) => ({
      value: c.slug,
      label: `${c.icon ?? "·"} ${c.label}`,
    })),
  ].sort((a, b) => {
    // Saca emojis/símbolos iniciales para ordenar por texto
    const strip = (s: string) => s.replace(/^[\s·🏪🛒🍽️☕🛵⛽🚕🛣️🅿️💊🏥🎓👕📱🛍️📦🛋️🔧📺💻🎮🎭✈️🏨🗺️💄💪🐾⚡📡🛡️📋🏦💵🎁❤️👔📚🚗🎨]+/gu, "").trim();
    return strip(a.label).localeCompare(strip(b.label), "es");
  });

  return (
    <div className="v2-card" style={{ marginTop: 16, padding: 0 }}>
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
          <div className="v2-card-title">✨ Entrenar la IA — reclasificar merchants</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
            {merchants.length} merchants detectados · click en un merchant para corregir su tipo;
            el sistema aprende para próximas subidas
          </div>
        </div>
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
      </button>

      {open && (
        <>
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 200,
                display: "flex",
                gap: 8,
                alignItems: "center",
                background: "var(--surface-2)",
                borderRadius: 8,
                padding: "0 10px",
              }}
            >
              <Icon.search />
              <input
                type="text"
                placeholder="Buscar merchant…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--text-3)",
                    cursor: "pointer",
                    padding: 2,
                  }}
                >
                  <Icon.x />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleRebuild}
              disabled={isRebuilding}
              className="v2-btn sm primary"
              style={{ opacity: isRebuilding ? 0.6 : 1 }}
              title="Re-clasificar todos los merchants con las categorías/custom types/overrides actuales"
            >
              {isRebuilding ? (
                <>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      border: "2px solid currentColor",
                      borderTopColor: "transparent",
                      animation: "v2-spin 0.7s linear infinite",
                      marginRight: 6,
                    }}
                  />
                  Reclasificando…
                </>
              ) : (
                <>🔄 Rebuild con IA</>
              )}
            </button>
            {rebuildResult && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-2)",
                  width: "100%",
                  padding: "6px 10px",
                  background: "var(--surface-2)",
                  borderRadius: 6,
                }}
              >
                {rebuildResult}
              </div>
            )}
          </div>

          <div style={{ maxHeight: 500, overflow: "auto" }}>
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th style={{ textAlign: "right" }}>Items</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th>Tipo actual</th>
                  <th>Nuevo tipo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const currentTypeLabel = m.currentType
                    ? MERCHANT_TYPE_META[m.currentType as keyof typeof MERCHANT_TYPE_META]
                    : null;
                  return (
                    <tr key={m.merchant}>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{m.merchant}</td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--mono)",
                          fontSize: 12,
                          color: "var(--text-3)",
                        }}
                      >
                        {m.count}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 500,
                          fontVariantNumeric: "tabular-nums",
                          fontSize: 12,
                        }}
                      >
                        {fmtARS(m.total)}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {currentTypeLabel ? (
                          <span className="v2-badge">
                            {currentTypeLabel.icon} {currentTypeLabel.label}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-3)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <form
                          action={reclassifyMerchant}
                          id={`form-${m.merchant.replace(/\W/g, "_")}`}
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          <input type="hidden" name="merchant" value={m.merchant} />
                          <select
                            name="merchant_type"
                            defaultValue={m.currentType ?? "otros"}
                            className="v2-select"
                            style={{
                              fontSize: 12,
                              padding: "3px 6px",
                              minWidth: 170,
                            }}
                          >
                            {merchantTypeOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="v2-btn sm primary"
                            style={{ padding: "3px 8px" }}
                            title="Aplicar y aprender"
                          >
                            ✓
                          </button>
                        </form>
                      </td>
                      <td></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "var(--text-3)",
                  fontSize: 13,
                }}
              >
                Sin resultados para &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
