import { Icon } from "../Icon";

type Trend = "up" | "down" | "flat";

export function KPI({
  title,
  value,
  sub,
  trend,
  trendLabel,
}: {
  title: string;
  value: string;
  sub?: string;
  trend?: Trend;
  trendLabel?: string;
}) {
  const deltaClass = trend === "up" ? "up" : trend === "down" ? "down" : "flat";
  const icon = trend === "up" ? <Icon.up /> : trend === "down" ? <Icon.down /> : null;
  return (
    <div className="v2-card">
      <div className="v2-card-title">{title}</div>
      <div className="v2-kpi-value" style={{ marginTop: 8 }}>
        {value}
      </div>
      {(trendLabel || sub) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {trendLabel && (
            <span className={`v2-kpi-delta ${deltaClass}`}>
              {icon}
              {trendLabel}
            </span>
          )}
          {sub && <span style={{ fontSize: 12, color: "var(--text-3)" }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}
