import Link from "next/link";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { fmtMoney, fmtDateShort } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { KPI } from "@/components/v2/KPI";
import { CAT_COLOR, Icon } from "@/components/Icon";
import { MailList } from "@/components/v2/MailList";
import {
  payExpense,
  ignoreExpense,
  snoozeExpense,
  revertExpense,
  deleteExpense,
  changeCategory,
  changePaidAt,
} from "../actions";
import { triggerScan } from "../admin/actions";
import { ScanButton } from "@/components/v2/ScanButton";

export const dynamic = "force-dynamic";

type Status = "pending_approval" | "paid" | "postponed" | "ignored" | "auto_approved";

const FILTERS: Array<{ key: string; label: string; statuses?: Status[] }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendientes", statuses: ["pending_approval"] },
  { key: "paid", label: "Pagados", statuses: ["paid", "auto_approved"] },
  { key: "postponed", label: "Pospuestos", statuses: ["postponed"] },
  { key: "ignored", label: "Ignorados", statuses: ["ignored"] },
];

type SearchParams = Promise<{ filter?: string; id?: string }>;

export default async function MailPage({ searchParams }: { searchParams: SearchParams }) {
  const { filter = "all", id } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const baseQuery = supabase()
    .from("expenses")
    .select(
      "id, provider, concept, amount_cents, currency, category_id, due_at, paid_at, detected_at, status, confidence_provider, confidence_amount, confidence_due, source_from, source_message_id, raw_extract_json",
    )
    .eq("user_id", WALLY_USER_ID)
    .order("detected_at", { ascending: false });

  const query = activeFilter.statuses
    ? baseQuery.in("status", activeFilter.statuses)
    : baseQuery;

  const { data: expenses } = await query;

  const { data: allExpenses } = await supabase()
    .from("expenses")
    .select("status, paid_at")
    .eq("user_id", WALLY_USER_ID);

  const total = allExpenses?.length ?? 0;
  const pendientes = allExpenses?.filter((e) => e.status === "pending_approval").length ?? 0;
  const auto = allExpenses?.filter((e) => e.status === "auto_approved").length ?? 0;
  const paidThisMonth =
    allExpenses?.filter((e) => {
      if (e.status !== "paid" && e.status !== "auto_approved") return false;
      if (!e.paid_at) return false;
      const d = new Date(e.paid_at);
      const now = new Date();
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    }).length ?? 0;

  const selected = id ? (expenses ?? []).find((e) => e.id === id) : (expenses ?? [])[0];

  return (
    <>
      <PageHeader section="General" title="Scan de Gastos" />

      <div className="v2-content">
        <div className="v2-grid v2-grid-4" style={{ marginBottom: 20 }}>
          <KPI title="Total detectados" value={String(total)} sub="desde conexión Gmail" />
          <KPI
            title="Necesitan atención"
            value={String(pendientes)}
            sub="pendientes de aprobar"
            trend={pendientes > 0 ? "up" : "flat"}
            trendLabel={pendientes > 0 ? "revisar" : "ok"}
          />
          <KPI title="Auto-aprobados" value={String(auto)} sub="por reglas con auto" />
          <KPI title="Pagados este mes" value={String(paidThisMonth)} sub="confirmados" />
        </div>

        <div className="v2-grid v2-grid-2-asym">
          <div className="v2-card" style={{ padding: 0 }}>
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="v2-card-title">Scan de Gastos</div>
                <form action={triggerScan}>
                  <ScanButton />
                </form>
              </div>
              <div className="v2-seg">
                {FILTERS.map((f) => (
                  <Link
                    key={f.key}
                    href={`/mail?filter=${f.key}`}
                    className={f.key === filter ? "active" : ""}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </div>

            <MailList
              expenses={expenses ?? []}
              filter={filter}
              selectedId={selected?.id}
            />
          </div>

          <div className="v2-card">
            {selected ? (
              <DetailPanel expense={selected} />
            ) : (
              <div style={{ color: "var(--text-3)", fontSize: 13 }}>
                Seleccioná un gasto de la lista para ver el detalle.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

type Expense = {
  id: string;
  provider: string;
  concept: string | null;
  amount_cents: number;
  currency: string;
  category_id: string | null;
  due_at: string | null;
  paid_at: string | null;
  detected_at: string;
  status: string;
  confidence_provider: number | null;
  confidence_amount: number | null;
  confidence_due: number | null;
  source_from: string | null;
  source_message_id: string | null;
  raw_extract_json: Record<string, unknown> | null;
};

async function DetailPanel({ expense }: { expense: Expense }) {
  const cat = (expense.category_id ?? "servicios") as CategoriaKey;
  const catInfo = CATEGORIAS[cat];

  // Cargar statement items si es tarjeta
  let statementItems: Array<{
    id: string;
    merchant: string;
    merchant_raw: string | null;
    amount_cents: number;
    currency: string;
    purchase_date: string | null;
    cuota_numero: number | null;
    cuota_total: number | null;
    category_id: string | null;
  }> | null = null;

  // NOTA: el análisis de consumos vive en /analisis (separado del tracking).
  // Esta sección queda por compatibilidad con expenses antiguos que tuvieran items linkeados.
  if (cat === "tarjeta") {
    const { data } = await supabase()
      .from("statement_items")
      .select(
        "id, merchant, merchant_raw, amount_cents, currency, purchase_date, cuota_numero, cuota_total, category_id",
      )
      .eq("expense_id", expense.id)
      .order("amount_cents", { ascending: false });
    statementItems = data ?? [];
  }

  return (
    <div>
      <div className="v2-card-title">Vista previa</div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 22,
          marginTop: 6,
          lineHeight: 1.2,
        }}
      >
        {expense.provider}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
        {expense.source_from ?? "—"} · {relativeTime(expense.detected_at)}
      </div>

      <hr className="v2-divider" style={{ margin: "18px 0 14px" }} />

      <div
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 500,
          marginBottom: 10,
        }}
      >
        Campos extraídos
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
        <Extract label="Proveedor" v={expense.provider} conf={expense.confidence_provider} />
        <Extract label="Concepto" v={expense.concept ?? "—"} conf={null} />
        <Extract
          label="Monto"
          v={fmtMoney(expense.amount_cents / 100, expense.currency as "ARS" | "USD")}
          conf={expense.confidence_amount}
        />
        <Extract
          label="Vencimiento"
          v={expense.due_at ? fmtDateShort(expense.due_at) : "—"}
          conf={expense.confidence_due}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 100, color: "var(--text-3)", fontSize: 12 }}>Categoría</span>
          <form
            action={changeCategory}
            style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}
          >
            <input type="hidden" name="id" value={expense.id} />
            <select
              name="category"
              defaultValue={cat}
              className="v2-select"
              style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}
            >
              {Object.entries(CATEGORIAS).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="submit" className="v2-btn sm ghost" title="Cambiar categoría">
              ✓
            </button>
          </form>
        </div>
        <Extract label="Estado" v={statusChip(expense.status as Status).label} conf={null} />
      </div>

      <hr className="v2-divider" style={{ margin: "18px 0 14px" }} />

      <div
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 500,
          marginBottom: 10,
        }}
      >
        Fecha (en qué mes cuenta)
      </div>
      <form
        action={changePaidAt}
        style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14 }}
      >
        <input type="hidden" name="id" value={expense.id} />
        <input
          type="date"
          name="date"
          defaultValue={
            (expense.paid_at
              ? new Date(expense.paid_at).toISOString().slice(0, 10)
              : expense.due_at ?? "") as string
          }
          className="v2-input"
          style={{ fontSize: 12, padding: "6px 8px", flex: 1 }}
        />
        <button type="submit" className="v2-btn sm ghost" title="Usar esta fecha como pagado">
          ✓
        </button>
      </form>

      <div
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 500,
          marginBottom: 10,
        }}
      >
        Acciones
      </div>
      <ActionButtons expense={expense} />

      {statementItems && statementItems.length > 0 && (
        <>
          <hr className="v2-divider" style={{ margin: "18px 0 14px" }} />
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 500,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Consumos del resumen ({statementItems.length})</span>
            <span style={{ color: "var(--text-3)", textTransform: "none" }}>
              total: ${Math.round(statementItems.reduce((s, it) => s + it.amount_cents / 100, 0)).toLocaleString("es-AR")}
            </span>
          </div>
          <div
            style={{
              maxHeight: 300,
              overflow: "auto",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            <table className="v2-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 10 }}>Merchant</th>
                  <th style={{ fontSize: 10 }}>Fecha</th>
                  <th style={{ textAlign: "right", fontSize: 10 }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {statementItems.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{it.merchant}</div>
                      {it.cuota_numero && it.cuota_total && (
                        <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                          cuota {it.cuota_numero}/{it.cuota_total}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--mono)" }}>
                      {it.purchase_date
                        ? new Date(it.purchase_date + "T00:00").toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontSize: 12,
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 500,
                      }}
                    >
                      {it.currency === "USD" ? "US$" : "$"}
                      {Math.round(it.amount_cents / 100).toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top 5 merchants by amount */}
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-3)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              Top merchants
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {topMerchants(statementItems)
                .slice(0, 5)
                .map((m) => (
                  <div
                    key={m.merchant}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      padding: "2px 0",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{m.merchant}</span>
                    <span
                      style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}
                    >
                      ${Math.round(m.total).toLocaleString("es-AR")}{" "}
                      <span style={{ color: "var(--text-3)", fontSize: 10 }}>
                        ({m.count})
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {expense.raw_extract_json && (
        <>
          <hr className="v2-divider" style={{ margin: "18px 0 14px" }} />
          <details>
            <summary
              style={{
                fontSize: 12,
                color: "var(--text-3)",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 500,
              }}
            >
              Respuesta cruda de Claude ↓
            </summary>
            <pre
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                background: "var(--surface-2)",
                padding: 10,
                borderRadius: 6,
                marginTop: 8,
                overflow: "auto",
                maxHeight: 240,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(expense.raw_extract_json, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function topMerchants(
  items: Array<{ merchant: string; amount_cents: number }>,
): Array<{ merchant: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (const it of items) {
    const key = it.merchant;
    const existing = map.get(key);
    if (existing) {
      existing.total += it.amount_cents / 100;
      existing.count++;
    } else {
      map.set(key, { total: it.amount_cents / 100, count: 1 });
    }
  }
  return Array.from(map.entries())
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.total - a.total);
}

function ActionButtons({ expense }: { expense: Expense }) {
  const status = expense.status as Status;
  const isPending = status === "pending_approval";
  const isPaid = status === "paid" || status === "auto_approved";
  const isIgnored = status === "ignored";
  const isPostponed = status === "postponed";

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {(isPending || isPostponed) && (
        <>
          <form action={payExpense} style={{ flex: "1 1 100px" }}>
            <input type="hidden" name="id" value={expense.id} />
            <button type="submit" className="v2-btn primary" style={{ width: "100%", justifyContent: "center" }}>
              <Icon.check /> Marcar pagado
            </button>
          </form>
          <form action={ignoreExpense} style={{ flex: "0 0 auto" }}>
            <input type="hidden" name="id" value={expense.id} />
            <button type="submit" className="v2-btn" title="Ignorar (sacar del total)">
              <Icon.x /> Ignorar
            </button>
          </form>
        </>
      )}

      {isPending && (
        <form action={snoozeExpense} style={{ flex: "0 0 auto" }}>
          <input type="hidden" name="id" value={expense.id} />
          <input type="hidden" name="days" value="3" />
          <button type="submit" className="v2-btn" title="Posponer 3 días">
            <Icon.clock /> 3d
          </button>
        </form>
      )}

      {(isPaid || isIgnored) && (
        <form action={revertExpense} style={{ flex: "1 1 100px" }}>
          <input type="hidden" name="id" value={expense.id} />
          <button type="submit" className="v2-btn" style={{ width: "100%", justifyContent: "center" }}>
            ↺ Volver a pendiente
          </button>
        </form>
      )}

      {isPaid && (
        <form action={ignoreExpense} style={{ flex: "0 0 auto" }}>
          <input type="hidden" name="id" value={expense.id} />
          <button type="submit" className="v2-btn" title="Mover a ignorados">
            <Icon.x /> Ignorar
          </button>
        </form>
      )}

      <form action={deleteExpense} style={{ flex: "0 0 auto", marginLeft: "auto" }}>
        <input type="hidden" name="id" value={expense.id} />
        <button
          type="submit"
          className="v2-btn ghost"
          title="Borrar de la DB"
          style={{ color: "var(--red)" }}
        >
          <Icon.trash />
        </button>
      </form>
    </div>
  );
}

function Extract({ label, v, conf }: { label: string; v: string; conf: number | null }) {
  const color = conf == null ? "var(--text-3)" : conf >= 97 ? "var(--green)" : "var(--amber)";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ width: 100, color: "var(--text-3)", fontSize: 12 }}>{label}</span>
      <span style={{ flex: 1, fontWeight: 500 }}>{v}</span>
      {conf != null && (
        <span style={{ fontSize: 11, fontFamily: "var(--mono)", color }}>{conf}%</span>
      )}
    </div>
  );
}

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
