import { fmtARS } from "@/lib/format";

export type DonutItem = { value: number; color: string };

export function DonutV2({ items, size = 160 }: { items: DonutItem[]; size?: number }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-3)",
          fontSize: 12,
        }}
      >
        sin datos
      </div>
    );
  }

  const r = size / 2 - 10;
  const C = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {items.map((it, i) => {
        const pct = it.value / total;
        const dash = C * pct;
        const rot = (acc / total) * 360 - 90;
        acc += it.value;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={it.color}
            strokeWidth="16"
            strokeDasharray={`${dash} ${C}`}
            transform={`rotate(${rot} ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        fontFamily="Instrument Serif"
        fontSize="22"
        fill="#141413"
      >
        total
      </text>
      <text
        x={size / 2}
        y={size / 2 + 18}
        textAnchor="middle"
        fontFamily="Geist"
        fontSize="14"
        fontWeight="500"
        fill="#141413"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {fmtARS(total)}
      </text>
    </svg>
  );
}
