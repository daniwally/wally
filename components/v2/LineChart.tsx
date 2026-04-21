export type LinePoint = { mes: string; total: number; prom: number; parcial?: boolean };

export function LineChart({
  data,
  w = 600,
  h = 220,
  keyField = "total",
}: {
  data: LinePoint[];
  w?: number;
  h?: number;
  keyField?: "total" | "prom";
}) {
  const vals = data.map((d) => d[keyField]);
  const max = Math.max(...vals) * 1.08;
  const min = Math.min(...vals) * 0.9;
  const pad = { l: 44, r: 12, t: 16, b: 28 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * iw;
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;

  let d = `M ${x(0)} ${y(vals[0])}`;
  for (let i = 1; i < data.length; i++) {
    const px = x(i - 1);
    const py = y(vals[i - 1]);
    const cx = x(i);
    const cy = y(vals[i]);
    const mx = (px + cx) / 2;
    d += ` C ${mx} ${py}, ${mx} ${cy}, ${cx} ${cy}`;
  }

  const gridY = [0, 0.25, 0.5, 0.75, 1].map((t) => pad.t + ih * t);
  const gridVals = [
    max,
    max - (max - min) * 0.25,
    (max + min) / 2,
    min + (max - min) * 0.25,
    min,
  ];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#141413" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#141413" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridY.map((gy, i) => (
        <line key={i} x1={pad.l} y1={gy} x2={w - pad.r} y2={gy} stroke="#e6e6df" strokeWidth="1" />
      ))}
      {gridVals.map((v, i) => (
        <text
          key={i}
          x={pad.l - 8}
          y={gridY[i] + 4}
          fontFamily="Geist Mono"
          fontSize="10"
          fill="#8a8a83"
          textAnchor="end"
        >
          {"$" + Math.round(v / 1000) + "k"}
        </text>
      ))}
      <path d={d + ` L ${x(data.length - 1)} ${pad.t + ih} L ${x(0)} ${pad.t + ih} Z`} fill="url(#lineFill)" />
      <path d={d} stroke="#141413" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle
        cx={x(data.length - 1)}
        cy={y(vals[vals.length - 1])}
        r="4"
        fill="#c2410c"
        stroke="#fff"
        strokeWidth="2"
      />
      {data.map((pt, i) => (
        <text
          key={i}
          x={x(i)}
          y={h - 10}
          fontFamily="Geist"
          fontSize="11"
          fill={i === data.length - 1 ? "#141413" : "#8a8a83"}
          fontWeight={i === data.length - 1 ? 600 : 400}
          textAnchor="middle"
        >
          {pt.mes}
        </text>
      ))}
    </svg>
  );
}
