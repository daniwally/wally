import { wobblyLine } from "../charts/wobbly";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { fmtARS } from "@/lib/format";

export type TimelineEvent = {
  id: string;
  dia: number;
  nombre: string;
  monto: number;
  pagado: boolean;
  cat: CategoriaKey;
};

export function Timeline({
  hoy,
  diasMes,
  eventos,
  pendingLabels,
}: {
  hoy: number;
  diasMes: number;
  eventos: TimelineEvent[];
  pendingLabels: Array<{ id: string; proveedor: string; monto: number; dia: number }>;
}) {
  const w = 1200;
  const h = 150;
  const padL = 20;
  const padR = 20;
  const xOf = (d: number) => padL + ((d - 1) / (diasMes - 1)) * (w - padL - padR);
  const axisY = 90;

  const byDay: Record<number, TimelineEvent[]> = {};
  eventos.forEach((e) => {
    (byDay[e.dia] = byDay[e.dia] || []).push(e);
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <path
        d={wobblyLine(padL, axisY, w - padR, axisY, 1.5, 0)}
        stroke="#1a1a1a"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {[1, 5, 10, 15, 20, 25, 30].map((d) => (
        <g key={d}>
          <path d={`M ${xOf(d)} ${axisY - 4} L ${xOf(d)} ${axisY + 4}`} stroke="#1a1a1a" strokeWidth="1.5" />
          <text
            x={xOf(d)}
            y={axisY + 20}
            fontFamily="Kalam"
            fontSize="13"
            fontWeight={d === hoy ? 700 : 400}
            fill={d === hoy ? "#e85d5d" : "#3a3a3a"}
            textAnchor="middle"
          >
            {d === hoy ? "HOY" : d}
          </text>
        </g>
      ))}

      <path
        d={`M ${xOf(hoy)} 8 L ${xOf(hoy)} ${h - 8}`}
        stroke="#e85d5d"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="4 3"
      />

      {Object.entries(byDay).map(([dia, evs]) => {
        const d = Number(dia);
        const above = d < hoy;
        return evs.map((ev, i) => {
          const size = Math.min(14, 5 + ev.monto / 60000);
          const y = above ? axisY - 14 - i * 14 : axisY + 32 + i * 14;
          const color = CATEGORIAS[ev.cat]?.soft ?? "#ddd";
          const stroke = ev.pagado ? "#1a1a1a" : "#e85d5d";
          return (
            <g key={`${dia}-${i}`}>
              <path
                d={`M ${xOf(d)} ${axisY} L ${xOf(d)} ${y + (above ? size / 2 : -size / 2)}`}
                stroke={stroke}
                strokeWidth="1.2"
                fill="none"
                opacity="0.5"
              />
              <circle
                cx={xOf(d)}
                cy={y}
                r={size}
                fill={color}
                stroke={stroke}
                strokeWidth="1.8"
                strokeDasharray={ev.pagado ? "0" : "3 2"}
              />
            </g>
          );
        });
      })}

      {pendingLabels.slice(0, 3).map((p, i) => {
        if (p.dia > diasMes) return null;
        const px = xOf(p.dia);
        const py = axisY + 80;
        return (
          <text
            key={p.id}
            x={px}
            y={py - 30 + i * 14}
            fontFamily="Caveat"
            fontSize="16"
            fontWeight="700"
            fill="#e85d5d"
            textAnchor="middle"
          >
            {p.proveedor} {fmtARS(p.monto)}
          </text>
        );
      })}
    </svg>
  );
}
