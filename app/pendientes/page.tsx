import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { fmtMoney, fmtDateShort, diasHasta } from "@/lib/format";
import { CAT_COLOR, CAT_ICON, Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { KPI } from "@/components/v2/KPI";
import { payExpense, ignoreExpense, snoozeExpense } from "../actions";
import { fmtARS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PendientesPage() {
  const { data: pendientes } = await supabase()
    .from("expenses")
    .select("id, provider, concept, amount_cents, currency, category_id, due_at, source_from, confidence_amount")
    .eq("user_id", WALLY_USER_ID)
    .eq("status", "pending_approval")
    .order("due_at", { ascending: true, nullsFirst: false });

  const list = pendientes ?? [];
  const totalArs = list
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + e.amount_cents / 100, 0);
  const totalUsd = list
    .filter((e) => e.currency === "USD")
    .reduce((s, e) => s + e.amount_cents / 100, 0);

  const urgentes = list.filter((e) => {
    if (!e.due_at) return false;
    const d = diasHasta(e.due_at);
    return d >= 0 && d <= 7;
  });
  const vencidos = list.filter((e) => {
    if (!e.due_at) return false;
    return diasHasta(e.due_at) < 0;
  });

  return (
    <>
      <PageHeader section="General" title="Pendientes" />

      <div className="v2-content">
        <div className="v2-grid v2-grid-3" style={{ marginBottom: 16 }}>
          <KPI
            title="Total a aprobar"
            value={fmtARS(totalArs)}
            sub={`${list.length} gastos · ${totalUsd > 0 ? `US$${totalUsd.toFixed(2)} adicional` : "todo ARS"}`}
          />
          <KPI
            title="Vence esta semana"
            value={String(urgentes.length)}
            sub={fmtARS(urgentes.reduce((s, e) => s + e.amount_cents / 100, 0))}
            trend={urgentes.length > 0 ? "up" : "flat"}
            trendLabel={urgentes.length > 0 ? "urgente" : "sin urgencias"}
          />
          <KPI
            title="Vencidos"
            value={String(vencidos.length)}
            sub={vencidos.length === 0 ? "al día" : fmtARS(vencidos.reduce((s, e) => s + e.amount_cents / 100, 0))}
            trend={vencidos.length > 0 ? "up" : "flat"}
            trendLabel={vencidos.length > 0 ? "atrasado" : "ok"}
          />
        </div>

        <div className="v2-card" style={{ padding: 0 }}>
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <div className="v2-card-title">Todos los pendientes</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                ordenados por vencimiento
              </div>
            </div>
          </div>

          {list.length === 0 ? (
            <div style={{ padding: 30, color: "var(--text-3)", fontSize: 13, textAlign: "center" }}>
              No tenés gastos pendientes de aprobar. Cuando Wally detecte nuevos mails, van a
              aparecer acá.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Categoría</th>
                    <th>Vence</th>
                    <th style={{ textAlign: "right" }}>Monto</th>
                    <th>Fuente</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const cat = (p.category_id ?? "servicios") as CategoriaKey;
                    const catInfo = CATEGORIAS[cat];
                    const IconEl = CAT_ICON[cat] ?? CAT_ICON.servicios;
                    const d = p.due_at ? diasHasta(p.due_at) : null;
                    const urgent = d !== null && d <= 3;

                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span
                              className="v2-avatar"
                              style={{
                                background: "var(--surface-2)",
                                color: CAT_COLOR[cat] ?? "#737373",
                              }}
                            >
                              <IconEl />
                            </span>
                            <div>
                              <div style={{ fontWeight: 500 }}>{p.provider}</div>
                              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                                {p.concept ?? ""}
                              </div>
                            </div>
                          </div>
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
                        <td>
                          {p.due_at ? (
                            <>
                              <div style={{ fontVariantNumeric: "tabular-nums" }}>
                                {fmtDateShort(p.due_at)}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: urgent ? "var(--red)" : "var(--text-3)",
                                  fontWeight: urgent ? 500 : 400,
                                }}
                              >
                                {d! < 0 ? `hace ${Math.abs(d!)}d` : `en ${d}d`}
                              </div>
                            </>
                          ) : (
                            <span style={{ color: "var(--text-3)" }}>—</span>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 500,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {fmtMoney(p.amount_cents / 100, p.currency as "ARS" | "USD")}
                        </td>
                        <td
                          style={{
                            fontSize: 11.5,
                            color: "var(--text-3)",
                            fontFamily: "var(--mono)",
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.source_from ?? "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            <form action={payExpense}>
                              <input type="hidden" name="id" value={p.id} />
                              <button type="submit" className="v2-btn sm primary">
                                <Icon.check /> Pagar
                              </button>
                            </form>
                            <form action={snoozeExpense}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="days" value="3" />
                              <button type="submit" className="v2-btn sm" title="Posponer 3d">
                                <Icon.clock />
                              </button>
                            </form>
                            <form action={ignoreExpense}>
                              <input type="hidden" name="id" value={p.id} />
                              <button type="submit" className="v2-btn sm ghost" title="Ignorar">
                                <Icon.x />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
