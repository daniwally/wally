import { CAT_COLOR } from "../Icon";

export type TimelineEvent = {
  dia: number;
  monto: number;
  pagado: boolean;
  cat: string;
  nombre: string;
};

export function TimelineV2({
  eventos,
  diasMes = 30,
  hoy = 20,
}: {
  eventos: TimelineEvent[];
  diasMes?: number;
  hoy?: number;
}) {
  const byDay: Record<number, TimelineEvent[]> = {};
  eventos.forEach((e) => {
    (byDay[e.dia] = byDay[e.dia] || []).push(e);
  });
  const maxDay = Math.max(
    ...Object.values(byDay).map((evs) => evs.reduce((s, e) => s + e.monto, 0)),
    1,
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${diasMes}, 1fr)`,
        gap: 3,
        alignItems: "end",
        height: 110,
        marginTop: 8,
      }}
    >
      {Array.from({ length: diasMes }, (_, i) => {
        const d = i + 1;
        const evs = byDay[d] || [];
        const isPast = d < hoy;
        const isToday = d === hoy;
        return (
          <div
            key={d}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              height: "100%",
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column-reverse",
                width: "100%",
              }}
            >
              {evs.map((e, j) => (
                <div
                  key={j}
                  title={`${e.nombre}: $${Math.round(e.monto).toLocaleString("es-AR")}`}
                  style={{
                    width: "100%",
                    height: (e.monto / maxDay) * 90,
                    background: isPast ? CAT_COLOR[e.cat] ?? "#737373" : "transparent",
                    border: isPast ? "none" : `1.5px dashed ${CAT_COLOR[e.cat] ?? "#737373"}`,
                    opacity: isPast ? 0.85 : 1,
                    borderRadius: j === evs.length - 1 ? "3px 3px 0 0" : 0,
                    minHeight: 2,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontSize: 9.5,
                fontFamily: "Geist Mono",
                color: isToday ? "#c2410c" : "var(--text-4)",
                fontWeight: isToday ? 600 : 400,
              }}
            >
              {d}
            </div>
          </div>
        );
      })}
    </div>
  );
}
