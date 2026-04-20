export function KPICard({
  label,
  value,
  sub,
  accent = "yellow",
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "yellow" | "red" | "green" | "blue";
}) {
  const bg = {
    yellow: "var(--yellow)",
    red: "var(--red-soft)",
    green: "var(--green-soft)",
    blue: "var(--blue-soft)",
  }[accent];

  return (
    <div
      style={{
        padding: "18px 20px",
        background: "var(--paper)",
        border: "2px solid #1a1a1a",
        borderRadius: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 60,
          height: 60,
          background: bg,
          borderRadius: "0 14px 0 60%",
        }}
      />
      <div
        className="t-hand"
        style={{
          fontSize: 13,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: 1,
          position: "relative",
        }}
      >
        {label}
      </div>
      <div
        className="t-title"
        style={{ fontSize: 34, lineHeight: 1.1, marginTop: 4, position: "relative" }}
      >
        {value}
      </div>
      <div
        className="t-hand"
        style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 6, position: "relative" }}
      >
        {sub}
      </div>
    </div>
  );
}
