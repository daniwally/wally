import { Icon } from "../Icon";
import type { InsightRow } from "@/lib/data";

export function V2Insight({ ins }: { ins: InsightRow }) {
  const map = {
    alerta: { icon: <Icon.alert />, color: "var(--red)", bg: "var(--red-soft)" },
    insight: { icon: <Icon.sparkle />, color: "var(--green)", bg: "var(--green-soft)" },
    recordatorio: { icon: <Icon.clock />, color: "var(--amber)", bg: "var(--amber-soft)" },
    descubierto: { icon: <Icon.search />, color: "var(--blue)", bg: "var(--blue-soft)" },
  }[ins.type];

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 14px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: map.bg,
          color: map.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {map.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{ins.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{ins.detail}</div>
      </div>
    </div>
  );
}
