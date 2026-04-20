import { CATEGORIAS, type Pendiente } from "@/lib/mock-data";
import { fmtMoney, fmtDateShort, diasHasta } from "@/lib/format";

export function PendienteRow({ p }: { p: Pendiente }) {
  const cat = CATEGORIAS[p.cat];
  const dias = diasHasta(p.vence);
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
          {p.proveedor}
        </div>
        <div className="t-hand" style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {p.concepto} · vence {fmtDateShort(p.vence)}
          {urgente && (
            <span style={{ color: "var(--red)", fontWeight: 700 }}> · en {dias}d</span>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="t-title" style={{ fontSize: 20, lineHeight: 1 }}>
          {fmtMoney(p.monto, p.moneda)}
        </div>
      </div>
    </div>
  );
}
