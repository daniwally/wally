import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import type { ExpenseRow } from "@/lib/data";
import { fmtMoney, fmtDateShort, diasHasta } from "@/lib/format";

export function PendienteRow({ e }: { e: ExpenseRow }) {
  const catKey = (e.category_id ?? "servicios") as CategoriaKey;
  const cat = CATEGORIAS[catKey];
  const dias = e.due_at ? diasHasta(e.due_at) : 999;
  const urgente = dias <= 3;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        border: "1.5px solid #1a1a1a",
        borderRadius: 10,
        background: urgente ? "rgba(248,184,184,0.3)" : "var(--paper-2)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50% 40% 50% 45%",
          background: cat.soft,
          border: "2px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {cat.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="t-hand"
          style={{
            fontWeight: 700,
            fontSize: 15,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {e.provider}
        </div>
        <div className="t-hand" style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {e.concept} · vence {e.due_at ? fmtDateShort(e.due_at) : "—"}
          {urgente && (
            <span style={{ color: "var(--red)", fontWeight: 700 }}> · en {dias}d</span>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="t-title" style={{ fontSize: 20, lineHeight: 1 }}>
          {fmtMoney(e.amount_cents / 100, e.currency)}
        </div>
      </div>
    </div>
  );
}
