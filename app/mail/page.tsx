import Link from "next/link";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { fmtMoney, fmtDateShort } from "@/lib/format";
import { KPICard } from "@/components/dashboard/KPICard";

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
    .select("status, detected_at, paid_at")
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
    <div style={{ padding: "0 4px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Mail parser</h1>
        <p className="page-subtitle">Auditá qué detectó Claude en cada mail escaneado</p>
      </div>

      <div
        className="r-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KPICard
          label="Total detectados"
          value={String(total)}
          sub="desde conexión Gmail"
          accent="blue"
        />
        <KPICard
          label="Necesitan atención"
          value={String(pendientes)}
          sub="pendientes de aprobar"
          accent="red"
        />
        <KPICard
          label="Auto-aprobados"
          value={String(auto)}
          sub="por reglas con auto"
          accent="green"
        />
        <KPICard
          label="Pagados este mes"
          value={String(paidThisMonth)}
          sub="confirmados vía bot o auto"
          accent="yellow"
        />
      </div>

      <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
        {/* Lista */}
        <div
          className="paper-plain"
          style={{ padding: 22, border: "2px solid #1a1a1a", borderRadius: 14 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div className="section-title">Inbox escaneado</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={`/mail?filter=${f.key}`}
                  className={`chip ${f.key === filter ? "yellow" : ""}`}
                  style={{ textDecoration: "none", cursor: "pointer" }}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>

          {(!expenses || expenses.length === 0) && (
            <div
              className="t-hand"
              style={{ color: "var(--ink-3)", padding: "16px 0", fontSize: 15 }}
            >
              No hay expenses en este filtro. Probá agregar remitentes en{" "}
              <Link href="/admin" style={{ color: "var(--ink)" }}>
                /admin
              </Link>{" "}
              y correr un scan.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            {(expenses ?? []).map((e) => {
              const cat = (e.category_id ?? "servicios") as CategoriaKey;
              const catInfo = CATEGORIAS[cat];
              const isSelected = selected?.id === e.id;
              const statusChip = statusChipInfo(e.status as Status);

              return (
                <Link
                  key={e.id}
                  href={`/mail?filter=${filter}&id=${e.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderBottom: "1px dashed rgba(0,0,0,0.15)",
                    background: isSelected ? "rgba(255,231,121,0.3)" : "transparent",
                    borderLeft: isSelected
                      ? "3px solid var(--yellow-deep)"
                      : "3px solid transparent",
                    textDecoration: "none",
                    color: "var(--ink)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50% 40% 50% 45%",
                      background: catInfo.soft,
                      border: "2px solid var(--ink)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {catInfo.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-hand" style={{ fontSize: 13, color: "var(--ink-3)" }}>
                      {truncate(e.source_from ?? "—", 50)} ·{" "}
                      {relativeTime(e.detected_at)}
                    </div>
                    <div
                      className="t-hand"
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {e.provider} — {e.concept ?? "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", marginRight: 8 }}>
                    <div className="t-title" style={{ fontSize: 16, lineHeight: 1 }}>
                      {fmtMoney(e.amount_cents / 100, e.currency as "ARS" | "USD")}
                    </div>
                  </div>
                  <span className={`chip ${statusChip.color}`}>{statusChip.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Detalle */}
        <div>
          {selected ? (
            <DetailPanel expense={selected} />
          ) : (
            <div
              className="paper-plain"
              style={{
                padding: 22,
                border: "2px solid #1a1a1a",
                borderRadius: 14,
                color: "var(--ink-3)",
              }}
            >
              Seleccioná un gasto de la lista para ver el detalle de extracción.
            </div>
          )}
        </div>
      </div>
    </div>
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

function DetailPanel({ expense }: { expense: Expense }) {
  const cat = (expense.category_id ?? "servicios") as CategoriaKey;
  const catInfo = CATEGORIAS[cat];

  return (
    <div
      className="paper-plain"
      style={{
        padding: 22,
        border: "2px solid #1a1a1a",
        borderRadius: 14,
        position: "relative",
      }}
    >
      <div className="tape" style={{ top: -16, left: 32 }} />

      <div
        className="t-hand"
        style={{
          fontSize: 12,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Gasto extraído
      </div>
      <div className="t-title" style={{ fontSize: 22, lineHeight: 1.1, marginTop: 4, marginBottom: 4 }}>
        {expense.provider}
      </div>
      <div className="t-hand" style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 12 }}>
        {expense.concept ?? "—"}
      </div>

      <div className="t-hand" style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
        <b>De:</b> {expense.source_from ?? "—"}
        <br />
        <b>Detectado:</b> {new Date(expense.detected_at).toLocaleString("es-AR")}
        <br />
        <b>Gmail ID:</b>{" "}
        <span className="t-mono" style={{ fontSize: 11 }}>
          {expense.source_message_id ?? "—"}
        </span>
      </div>

      <hr className="scribble" />

      <div className="t-hand" style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
        Lo que Wally extrajo:
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontFamily: "var(--hand)",
          fontSize: 14,
        }}
      >
        <ExtractedField label="Proveedor" value={expense.provider} conf={expense.confidence_provider} />
        <ExtractedField label="Concepto" value={expense.concept ?? "—"} conf={null} />
        <ExtractedField
          label="Monto"
          value={fmtMoney(expense.amount_cents / 100, expense.currency as "ARS" | "USD")}
          conf={expense.confidence_amount}
        />
        <ExtractedField
          label="Vencimiento"
          value={expense.due_at ? fmtDateShort(expense.due_at) : "—"}
          conf={expense.confidence_due}
        />
        <ExtractedField
          label="Categoría"
          value={`${catInfo.label} ${catInfo.icon}`}
          conf={null}
        />
        <ExtractedField
          label="Estado"
          value={statusChipInfo(expense.status as Status).label}
          conf={null}
        />
      </div>

      {expense.raw_extract_json && (
        <>
          <hr className="scribble" />
          <details>
            <summary
              className="t-hand"
              style={{ fontSize: 13, color: "var(--ink-3)", cursor: "pointer" }}
            >
              Ver respuesta cruda de Claude ↓
            </summary>
            <pre
              className="t-mono"
              style={{
                fontSize: 11,
                background: "var(--paper-2)",
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

function ExtractedField({
  label,
  value,
  conf,
}: {
  label: string;
  value: string;
  conf: number | null;
}) {
  const color = conf == null ? "var(--ink-4)" : conf >= 97 ? "var(--green)" : "var(--orange)";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ width: 110, color: "var(--ink-3)", fontSize: 13 }}>{label}</span>
      <span style={{ flex: 1, fontWeight: 700 }}>{value}</span>
      {conf != null && (
        <span style={{ fontSize: 11, color, fontFamily: "var(--mono)" }}>{conf}%</span>
      )}
    </div>
  );
}

function statusChipInfo(status: Status) {
  return {
    pending_approval: { color: "red", label: "aprobar" },
    paid: { color: "green", label: "pagado" },
    auto_approved: { color: "green", label: "auto" },
    postponed: { color: "orange", label: "pospuesto" },
    ignored: { color: "", label: "ignorado" },
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

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
