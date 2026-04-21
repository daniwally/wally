import { PageHeader } from "@/components/PageHeader";
import { KPI } from "@/components/v2/KPI";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { fmtARS } from "@/lib/format";
import { CAT_COLOR } from "@/components/Icon";

export const dynamic = "force-dynamic";

type ItemRow = {
  merchant: string;
  amount_cents: number;
  currency: string;
  purchase_date: string | null;
  cuota_numero: number | null;
  cuota_total: number | null;
  category_id: string | null;
  expense_id: string;
};

export default async function AnalisisPage() {
  const { data: itemsData } = await supabase()
    .from("statement_items")
    .select(
      "merchant, amount_cents, currency, purchase_date, cuota_numero, cuota_total, category_id, expense_id",
    )
    .eq("user_id", WALLY_USER_ID)
    .order("amount_cents", { ascending: false });

  const items = (itemsData ?? []) as ItemRow[];
  const itemsArs = items.filter((i) => i.currency === "ARS");
  const itemsUsd = items.filter((i) => i.currency === "USD");

  const totalArs = itemsArs.reduce((s, i) => s + i.amount_cents / 100, 0);
  const totalUsd = itemsUsd.reduce((s, i) => s + i.amount_cents / 100, 0);

  // Top merchants (ARS + USD separados)
  type MerchantAgg = {
    merchant: string;
    total: number;
    count: number;
    expenseIds: Set<string>;
    category: string | null;
  };
  const merchMap = new Map<string, MerchantAgg>();
  itemsArs.forEach((it) => {
    const existing = merchMap.get(it.merchant);
    if (existing) {
      existing.total += it.amount_cents / 100;
      existing.count++;
      existing.expenseIds.add(it.expense_id);
    } else {
      merchMap.set(it.merchant, {
        merchant: it.merchant,
        total: it.amount_cents / 100,
        count: 1,
        expenseIds: new Set([it.expense_id]),
        category: it.category_id,
      });
    }
  });
  const topMerchants = Array.from(merchMap.values()).sort((a, b) => b.total - a.total);

  // Recurrentes: aparece en 2+ resúmenes diferentes
  const recurrentes = topMerchants.filter((m) => m.expenseIds.size >= 2);

  // Por categoría
  const byCat = new Map<string, number>();
  itemsArs.forEach((it) => {
    const k = it.category_id ?? "sin-categoria";
    byCat.set(k, (byCat.get(k) ?? 0) + it.amount_cents / 100);
  });
  const catItems = Array.from(byCat.entries())
    .map(([k, v]) => ({
      key: k,
      label: (CATEGORIAS[k as CategoriaKey]?.label ?? "Sin categoría"),
      color: CAT_COLOR[k] ?? "#737373",
      total: v,
    }))
    .sort((a, b) => b.total - a.total);

  // Cuotas en curso: items con cuota_numero < cuota_total
  const cuotasEnCurso = itemsArs.filter(
    (it) => it.cuota_numero && it.cuota_total && it.cuota_numero < it.cuota_total,
  );
  const cuotasMap = new Map<string, { merchant: string; cuotaNum: number; cuotaTot: number; monto: number }>();
  cuotasEnCurso.forEach((it) => {
    const key = `${it.merchant}__${it.amount_cents}`;
    const existing = cuotasMap.get(key);
    if (!existing || it.cuota_numero! > existing.cuotaNum) {
      cuotasMap.set(key, {
        merchant: it.merchant,
        cuotaNum: it.cuota_numero!,
        cuotaTot: it.cuota_total!,
        monto: it.amount_cents / 100,
      });
    }
  });
  const cuotas = Array.from(cuotasMap.values()).sort((a, b) => b.monto - a.monto);
  const totalCuotasPendientes = cuotas.reduce(
    (s, c) => s + c.monto * (c.cuotaTot - c.cuotaNum),
    0,
  );

  return (
    <>
      <PageHeader section="General" title="Análisis de consumos" />

      <div className="v2-content">
        {items.length === 0 ? (
          <div
            className="v2-card"
            style={{ padding: 30, textAlign: "center", color: "var(--text-3)" }}
          >
            Todavía no hay consumos analizados. Subí un resumen de tarjeta via{" "}
            <a href="/nuevo" style={{ color: "var(--text)" }}>
              /nuevo
            </a>{" "}
            o Telegram y se analizan automáticamente.
          </div>
        ) : (
          <>
            <div className="v2-grid v2-grid-4" style={{ marginBottom: 16 }}>
              <KPI title="Consumos analizados" value={String(items.length)} sub="items" />
              <KPI title="Total ARS" value={fmtARS(totalArs)} sub="sumando todos" />
              <KPI
                title="Total USD"
                value={`US$${totalUsd.toFixed(2)}`}
                sub="dólares separados"
              />
              <KPI
                title="Recurrentes"
                value={String(recurrentes.length)}
                sub="en 2+ resúmenes"
              />
            </div>

            <div className="v2-grid v2-grid-2-asym" style={{ marginBottom: 16 }}>
              {/* Top merchants */}
              <div className="v2-card" style={{ padding: 0 }}>
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div className="v2-card-title">Top merchants</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                    ranking por total gastado (ARS)
                  </div>
                </div>
                <div style={{ maxHeight: 500, overflow: "auto" }}>
                  <table className="v2-table">
                    <thead>
                      <tr>
                        <th>Merchant</th>
                        <th>Categoría</th>
                        <th style={{ textAlign: "right" }}>Resúmenes</th>
                        <th style={{ textAlign: "right" }}>Items</th>
                        <th style={{ textAlign: "right" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topMerchants.slice(0, 50).map((m) => {
                        const catKey = (m.category ?? "sin") as CategoriaKey;
                        const catInfo = CATEGORIAS[catKey];
                        const pct = totalArs > 0 ? (m.total / totalArs) * 100 : 0;
                        return (
                          <tr key={m.merchant}>
                            <td style={{ fontWeight: 500 }}>
                              {m.merchant}
                              {m.expenseIds.size >= 2 && (
                                <span
                                  className="v2-badge blue"
                                  style={{ marginLeft: 6, fontSize: 9.5 }}
                                >
                                  recurrente
                                </span>
                              )}
                            </td>
                            <td>
                              {catInfo ? (
                                <span className="v2-badge">
                                  <span
                                    className="v2-cat-dot"
                                    style={{
                                      background: CAT_COLOR[m.category ?? ""] ?? "#737373",
                                    }}
                                  />
                                  {catInfo.label}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontFamily: "var(--mono)",
                                fontSize: 12,
                                color: "var(--text-3)",
                              }}
                            >
                              {m.expenseIds.size}
                            </td>
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
                            <td style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                                {fmtARS(m.total)}
                              </div>
                              <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                                {pct.toFixed(1)}%
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Por categoría */}
              <div className="v2-card">
                <div className="v2-card-header">
                  <div className="v2-card-title">Por categoría</div>
                  <span className="v2-badge">ARS</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {catItems.map((c) => {
                    const pct = totalArs > 0 ? (c.total / totalArs) * 100 : 0;
                    return (
                      <div key={c.key}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</span>
                          <span
                            style={{
                              fontSize: 13,
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 500,
                            }}
                          >
                            {fmtARS(c.total)}
                          </span>
                        </div>
                        <div className="v2-progress">
                          <div style={{ width: `${pct}%`, background: c.color }} />
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-3)",
                            textAlign: "right",
                            marginTop: 2,
                          }}
                        >
                          {pct.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cuotas en curso */}
            {cuotas.length > 0 && (
              <div className="v2-card" style={{ padding: 0 }}>
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div className="v2-card-title">Cuotas en curso</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                      compras financiadas que todavía no terminaron
                    </div>
                  </div>
                  <span
                    className="v2-badge"
                    style={{ background: "var(--amber-soft)", color: "var(--amber)" }}
                  >
                    pendiente: {fmtARS(totalCuotasPendientes)}
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="v2-table">
                    <thead>
                      <tr>
                        <th>Merchant</th>
                        <th>Progreso</th>
                        <th style={{ textAlign: "right" }}>Cuota actual</th>
                        <th style={{ textAlign: "right" }}>Pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuotas.map((c) => {
                        const restantes = c.cuotaTot - c.cuotaNum;
                        const pct = (c.cuotaNum / c.cuotaTot) * 100;
                        return (
                          <tr key={c.merchant + c.monto}>
                            <td style={{ fontWeight: 500 }}>{c.merchant}</td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  maxWidth: 240,
                                }}
                              >
                                <div
                                  className="v2-progress"
                                  style={{ flex: 1, minWidth: 100 }}
                                >
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      background: "var(--accent)",
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontFamily: "var(--mono)",
                                    color: "var(--text-3)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {c.cuotaNum}/{c.cuotaTot}
                                </span>
                              </div>
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontVariantNumeric: "tabular-nums",
                                fontSize: 13,
                                fontWeight: 500,
                              }}
                            >
                              {fmtARS(c.monto)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontVariantNumeric: "tabular-nums",
                                fontSize: 13,
                                fontWeight: 500,
                                color: "var(--amber)",
                              }}
                            >
                              {fmtARS(c.monto * restantes)}
                              <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                                {restantes} restantes
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
