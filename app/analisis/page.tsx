import { PageHeader } from "@/components/PageHeader";
import { KPI } from "@/components/v2/KPI";
import { SubmitButton } from "@/components/v2/SubmitButton";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { fmtARS } from "@/lib/format";
import { CAT_COLOR, Icon } from "@/components/Icon";
import { analyzeStatement, deleteStatementBatch } from "../actions";

export const dynamic = "force-dynamic";

type ItemRow = {
  merchant: string;
  amount_cents: number;
  currency: string;
  purchase_date: string | null;
  cuota_numero: number | null;
  cuota_total: number | null;
  category_id: string | null;
  upload_batch_id: string | null;
  source_provider: string | null;
  source_period: string | null;
};

type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { ok, error } = await searchParams;

  const { data: itemsData } = await supabase()
    .from("statement_items")
    .select(
      "merchant, amount_cents, currency, purchase_date, cuota_numero, cuota_total, category_id, upload_batch_id, source_provider, source_period",
    )
    .eq("user_id", WALLY_USER_ID)
    .order("amount_cents", { ascending: false });

  const items = (itemsData ?? []) as ItemRow[];
  const itemsArs = items.filter((i) => i.currency === "ARS");
  const itemsUsd = items.filter((i) => i.currency === "USD");

  const totalArs = itemsArs.reduce((s, i) => s + i.amount_cents / 100, 0);
  const totalUsd = itemsUsd.reduce((s, i) => s + i.amount_cents / 100, 0);

  // Batches: agrupar por upload_batch_id para listar los resúmenes subidos
  type BatchInfo = {
    batchId: string;
    provider: string;
    period: string | null;
    itemCount: number;
    totalArs: number;
  };
  const batchMap = new Map<string, BatchInfo>();
  items.forEach((it) => {
    if (!it.upload_batch_id) return;
    const existing = batchMap.get(it.upload_batch_id);
    if (existing) {
      existing.itemCount++;
      if (it.currency === "ARS") existing.totalArs += it.amount_cents / 100;
    } else {
      batchMap.set(it.upload_batch_id, {
        batchId: it.upload_batch_id,
        provider: it.source_provider ?? "Resumen",
        period: it.source_period,
        itemCount: 1,
        totalArs: it.currency === "ARS" ? it.amount_cents / 100 : 0,
      });
    }
  });
  const batches = Array.from(batchMap.values()).sort((a, b) =>
    (b.period ?? "").localeCompare(a.period ?? ""),
  );

  // Top merchants (ARS)
  type MerchantAgg = {
    merchant: string;
    total: number;
    count: number;
    batchIds: Set<string>;
    category: string | null;
  };
  const merchMap = new Map<string, MerchantAgg>();
  itemsArs.forEach((it) => {
    const existing = merchMap.get(it.merchant);
    if (existing) {
      existing.total += it.amount_cents / 100;
      existing.count++;
      if (it.upload_batch_id) existing.batchIds.add(it.upload_batch_id);
    } else {
      merchMap.set(it.merchant, {
        merchant: it.merchant,
        total: it.amount_cents / 100,
        count: 1,
        batchIds: new Set(it.upload_batch_id ? [it.upload_batch_id] : []),
        category: it.category_id,
      });
    }
  });
  const topMerchants = Array.from(merchMap.values()).sort((a, b) => b.total - a.total);
  const recurrentes = topMerchants.filter((m) => m.batchIds.size >= 2);

  // Por categoría
  const byCat = new Map<string, number>();
  itemsArs.forEach((it) => {
    const k = it.category_id ?? "sin-categoria";
    byCat.set(k, (byCat.get(k) ?? 0) + it.amount_cents / 100);
  });
  const catItems = Array.from(byCat.entries())
    .map(([k, v]) => ({
      key: k,
      label: CATEGORIAS[k as CategoriaKey]?.label ?? "Sin categoría",
      color: CAT_COLOR[k] ?? "#737373",
      total: v,
    }))
    .sort((a, b) => b.total - a.total);

  // Cuotas en curso
  const cuotasMap = new Map<string, { merchant: string; cuotaNum: number; cuotaTot: number; monto: number }>();
  itemsArs.forEach((it) => {
    if (!it.cuota_numero || !it.cuota_total || it.cuota_numero >= it.cuota_total) return;
    const key = `${it.merchant}__${it.amount_cents}`;
    const existing = cuotasMap.get(key);
    if (!existing || it.cuota_numero > existing.cuotaNum) {
      cuotasMap.set(key, {
        merchant: it.merchant,
        cuotaNum: it.cuota_numero,
        cuotaTot: it.cuota_total,
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
      <PageHeader
        section="General"
        title="Análisis de consumos"
        right={
          <span className="v2-badge outline">
            <Icon.sparkle /> Independiente del tracking
          </span>
        }
      />

      <div className="v2-content">
        {ok && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 16,
              border: "1px solid var(--green)",
              background: "var(--green-soft)",
              color: "var(--green)",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            ✓ Analizado: <strong>{decodeURIComponent(ok)}</strong>
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 16,
              border: "1px solid var(--red)",
              background: "var(--red-soft)",
              color: "var(--red)",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        {/* Uploader */}
        <div className="v2-card" style={{ marginBottom: 16 }}>
          <div className="v2-card-header">
            <div>
              <div className="v2-card-title">Subir resumen para analizar</div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                Extrae consumos, merchants y cuotas. <strong>No se crea gasto</strong> — solo
                se suma al análisis.
              </div>
            </div>
          </div>
          <form
            action={analyzeStatement}
            encType="multipart/form-data"
            style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
          >
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              className="v2-input"
              style={{ flex: 1, minWidth: 260, padding: "6px 10px", fontSize: 13 }}
              required
            />
            <SubmitButton loadingLabel="Analizando…">
              <Icon.sparkle /> Analizar
            </SubmitButton>
          </form>
        </div>

        {items.length === 0 ? (
          <div
            className="v2-card"
            style={{ padding: 30, textAlign: "center", color: "var(--text-3)" }}
          >
            Todavía no hay consumos analizados. Subí un resumen arriba ↑
          </div>
        ) : (
          <>
            <div className="v2-grid v2-grid-4" style={{ marginBottom: 16 }}>
              <KPI title="Consumos" value={String(items.length)} sub={`${batches.length} resúmenes`} />
              <KPI title="Total ARS" value={fmtARS(totalArs)} sub="sumando todo" />
              <KPI title="Total USD" value={`US$${totalUsd.toFixed(2)}`} sub="dólares" />
              <KPI
                title="Recurrentes"
                value={String(recurrentes.length)}
                sub="en 2+ resúmenes"
              />
            </div>

            {/* Resúmenes subidos */}
            <div className="v2-card" style={{ marginBottom: 16, padding: 0 }}>
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="v2-card-title">Resúmenes analizados</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  borrá un batch y desaparecen todos sus items del análisis
                </div>
              </div>
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Período</th>
                    <th style={{ textAlign: "right" }}>Items</th>
                    <th style={{ textAlign: "right" }}>Total ARS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.batchId}>
                      <td style={{ fontWeight: 500 }}>{b.provider}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                        {b.period ?? "—"}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--mono)",
                          fontSize: 12,
                        }}
                      >
                        {b.itemCount}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 500,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmtARS(b.totalArs)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <form action={deleteStatementBatch}>
                          <input type="hidden" name="batch_id" value={b.batchId} />
                          <button
                            type="submit"
                            className="v2-btn sm ghost"
                            style={{ color: "var(--red)" }}
                            title="Borrar análisis de este resumen"
                          >
                            <Icon.trash />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="v2-grid v2-grid-2-asym" style={{ marginBottom: 16 }}>
              {/* Top merchants */}
              <div className="v2-card" style={{ padding: 0 }}>
                <div
                  style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}
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
                        <th style={{ textAlign: "right" }}>Res.</th>
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
                              {m.batchIds.size >= 2 && (
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
                              {m.batchIds.size}
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
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th>Merchant</th>
                      <th>Progreso</th>
                      <th style={{ textAlign: "right" }}>Cuota</th>
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
                              <div className="v2-progress" style={{ flex: 1, minWidth: 100 }}>
                                <div
                                  style={{ width: `${pct}%`, background: "var(--accent)" }}
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
            )}
          </>
        )}
      </div>
    </>
  );
}
