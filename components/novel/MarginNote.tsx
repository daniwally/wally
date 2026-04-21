import type { InsightRow } from "@/lib/data";

const ROTS = [-1, 1.5, -1.5, 1];
const ICONS = { alerta: "⚠", insight: "✨", recordatorio: "📅", descubierto: "🔍" };
const COLORS = {
  red: "var(--red)",
  green: "var(--green)",
  yellow: "var(--yellow-deep)",
  blue: "var(--blue)",
};

export function MarginNote({ ins, idx }: { ins: InsightRow; idx: number }) {
  const rot = ROTS[idx % ROTS.length];
  const icon = ICONS[ins.type];
  const color = COLORS[ins.color];

  return (
    <div
      style={{
        position: "relative",
        padding: "14px 16px 14px 22px",
        borderLeft: `4px solid ${color}`,
        background: "rgba(255,255,255,0.4)",
        transform: `rotate(${rot}deg)`,
      }}
    >
      <div
        className="t-hand"
        style={{ fontWeight: 700, fontSize: 16, display: "flex", gap: 6, alignItems: "center" }}
      >
        <span style={{ fontSize: 20 }}>{icon}</span>
        {ins.title}
      </div>
      <div
        className="t-hand"
        style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.3 }}
      >
        {ins.detail}
      </div>
    </div>
  );
}
