import { wobblyLine } from "./wobbly";

export type LinePoint = { mes: string; total: number; prom: number; parcial?: boolean };

export function SketchyLineChart({
  data,
  w = 560,
  h = 200,
  keyField = "total",
}: {
  data: LinePoint[];
  w?: number;
  h?: number;
  keyField?: "total" | "prom";
}) {
  const vals = data.map((d) => d[keyField]);
  const max = Math.max(...vals) * 1.1;
  const min = Math.min(...vals) * 0.85;
  const pad = { l: 40, r: 16, t: 16, b: 28 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * iw;
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;

  let d = `M ${x(0)} ${y(vals[0])}`;
  for (let i = 1; i < data.length; i++) {
    const px = x(i);
    const py = y(vals[i]);
    const ppx = x(i - 1);
    const ppy = y(vals[i - 1]);
    const mx = (ppx + px) / 2 + Math.sin(i * 1.3) * 3;
    const my = (ppy + py) / 2 + Math.cos(i * 1.7) * 3;
    d += ` Q ${mx} ${my} ${px} ${py}`;
  }

  const gridY = [0, 0.33, 0.66, 1].map((t) => pad.t + ih * t);
  const last = data.length - 1;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      {gridY.map((gy, i) => (
        <path
          key={i}
          d={wobblyLine(pad.l, gy, w - pad.r, gy, 0.8, i * 2)}
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 4"
        />
      ))}
      {[max, (max + min) / 2, min].map((v, i) => (
        <text
          key={i}
          x={pad.l - 6}
          y={pad.t + (ih * i) / 2 + 4}
          fontFamily="Kalam"
          fontSize="11"
          fill="#6a6a6a"
          textAnchor="end"
        >
          {"$" + Math.round(v / 1000) + "k"}
        </text>
      ))}
      <path
        d={wobblyLine(pad.l, h - pad.b, w - pad.r, h - pad.b, 1, 9)}
        stroke="#1a1a1a"
        strokeWidth="1.5"
        fill="none"
      />
      <path d={d} stroke="#1a1a1a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path
        d={d + ` L ${x(last)} ${pad.t + ih} L ${x(0)} ${pad.t + ih} Z`}
        fill="rgba(255, 231, 121, 0.45)"
        stroke="none"
      />
      {data.map((pt, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(pt[keyField])}
          r={pt.parcial ? 6 : 4.5}
          fill={pt.parcial ? "var(--yellow)" : "var(--paper)"}
          stroke="#1a1a1a"
          strokeWidth="2"
          strokeDasharray={pt.parcial ? "3 2" : "0"}
        />
      ))}
      {data.map((pt, i) => (
        <text
          key={i}
          x={x(i)}
          y={h - 8}
          fontFamily="Kalam"
          fontSize="12"
          fill="#3a3a3a"
          textAnchor="middle"
        >
          {pt.mes}
        </text>
      ))}
      <g>
        <path
          d={`M ${x(last) - 18} ${y(vals[last]) - 32}
              Q ${x(last) - 5} ${y(vals[last]) - 40}
                ${x(last) - 2} ${y(vals[last]) - 12}`}
          stroke="#e85d5d"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <polygon
          points={`${x(last) - 4},${y(vals[last]) - 10} ${x(last) - 10},${y(vals[last]) - 16} ${x(last) + 2},${y(vals[last]) - 18}`}
          fill="#e85d5d"
        />
        <text
          x={x(last) - 22}
          y={y(vals[last]) - 38}
          fontFamily="Caveat"
          fontSize="18"
          fontWeight="700"
          fill="#e85d5d"
          textAnchor="end"
        >
          ¡acá!
        </text>
      </g>
    </svg>
  );
}
