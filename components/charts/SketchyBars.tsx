import { wobblyLine } from "./wobbly";
import { fmtARS } from "@/lib/format";

export type BarItem = { label: string; value: number; color: string; stroke: string };

export function SketchyBars({
  items,
  max,
  h = 200,
  w = 400,
}: {
  items: BarItem[];
  max: number;
  h?: number;
  w?: number;
}) {
  const pad = { l: 80, r: 16, t: 12, b: 12 };
  const iw = w - pad.l - pad.r;
  const barH = (h - pad.t - pad.b) / items.length - 8;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      {items.map((it, i) => {
        const y = pad.t + i * (barH + 8);
        const bw = (it.value / max) * iw;
        return (
          <g key={i}>
            <text
              x={pad.l - 8}
              y={y + barH / 2 + 5}
              fontFamily="Kalam"
              fontSize="13"
              fontWeight="700"
              fill="#1a1a1a"
              textAnchor="end"
            >
              {it.label}
            </text>
            <rect
              x={pad.l}
              y={y}
              width={bw}
              height={barH}
              fill={it.color}
              stroke="#1a1a1a"
              strokeWidth="1.8"
              rx="3"
              ry="3"
            />
            <path
              d={wobblyLine(pad.l + 2, y + barH - 2, pad.l + bw - 2, y + barH - 2, 0.8, i)}
              stroke="rgba(0,0,0,0.12)"
              strokeWidth="1"
              fill="none"
            />
            <text
              x={pad.l + bw + 6}
              y={y + barH / 2 + 5}
              fontFamily="Kalam"
              fontSize="12"
              fontWeight="700"
              fill="#1a1a1a"
            >
              {fmtARS(it.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
