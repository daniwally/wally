export type DonutItem = { value: number; color: string; stroke: string };

export function SketchyDonut({ items, size = 180 }: { items: DonutItem[]; size?: number }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return <div style={{ width: size, height: size }} />;

  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;

  const arcs = items.map((it) => {
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += it.value;
    const a2 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = a2 - a1 > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    return {
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      color: it.color,
      stroke: it.stroke,
    };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {arcs.map((a, i) => (
        <path
          key={i}
          d={a.d}
          fill={a.color}
          stroke={a.stroke}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--paper)" stroke="#1a1a1a" strokeWidth="1.8" />
    </svg>
  );
}
