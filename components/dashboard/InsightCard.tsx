import type { Insight } from "@/lib/mock-data";

export function InsightCard({ ins }: { ins: Insight }) {
  const bg = {
    red: "var(--red-soft)",
    green: "var(--green-soft)",
    yellow: "var(--yellow)",
    blue: "var(--blue-soft)",
  }[ins.color];

  const icon = { alerta: "⚠", insight: "✨", recordatorio: "📅", descubierto: "🔍" }[ins.tipo];

  return (
    <div
      style={{
        padding: 12,
        background: bg,
        border: "1.5px solid #1a1a1a",
        borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
        <span>{icon}</span>
        <span className="t-hand" style={{ fontWeight: 700 }}>
          {ins.titulo}
        </span>
      </div>
      <div className="t-hand" style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
        {ins.detalle}
      </div>
    </div>
  );
}
