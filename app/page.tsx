import { CATEGORIAS, HISTORICO, MES_ACTUAL, type CategoriaKey } from "@/lib/mock-data";
import { fmtARS } from "@/lib/format";
import { getDashboardData } from "@/lib/data";
import { SketchyLineChart } from "@/components/charts/SketchyLineChart";
import { SketchyBars } from "@/components/charts/SketchyBars";
import { KPICard } from "@/components/dashboard/KPICard";
import { PendienteRow } from "@/components/dashboard/PendienteRow";
import { InsightCard } from "@/components/dashboard/InsightCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { pendientes, pagados, insights, totalArsMes, pendienteArs } = await getDashboardData();

  const cats: Partial<Record<CategoriaKey, number>> = {};
  pagados
    .filter((e) => e.currency === "ARS" && e.category_id)
    .forEach((e) => {
      const k = e.category_id as CategoriaKey;
      cats[k] = (cats[k] || 0) + e.amount_cents / 100;
    });
  pendientes
    .filter((e) => e.currency === "ARS" && e.category_id)
    .forEach((e) => {
      const k = e.category_id as CategoriaKey;
      cats[k] = (cats[k] || 0) + e.amount_cents / 100;
    });

  const catItems = (Object.entries(cats) as [CategoriaKey, number][])
    .map(([k, v]) => ({
      label: CATEGORIAS[k].label,
      value: v,
      color: CATEGORIAS[k].soft,
      stroke: CATEGORIAS[k].color,
    }))
    .sort((a, b) => b.value - a.value);

  const maxCat = catItems.length ? Math.max(...catItems.map((i) => i.value)) : 1;
  const totalPrev = HISTORICO[5].total;
  const delta = Math.round(((totalArsMes - totalPrev) / totalPrev) * 100);

  const vencenEstaSemana = pendientes.filter((e) => {
    if (!e.due_at) return false;
    const d = new Date(e.due_at + "T00:00");
    const hoy = new Date("2026-04-20T00:00");
    const diff = (d.getTime() - hoy.getTime()) / 86400000;
    return diff >= 0 && diff <= 7 && e.currency === "ARS";
  });

  return (
    <div style={{ padding: "0 4px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 18,
          marginBottom: 22,
        }}
      >
        <div
          className="paper-plain"
          style={{
            padding: "22px 26px",
            borderRadius: 14,
            position: "relative",
            border: "2px solid #1a1a1a",
          }}
        >
          <div
            className="t-hand"
            style={{
              fontSize: 14,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Gastado en {MES_ACTUAL}
          </div>
          <div className="t-title" style={{ fontSize: 72, lineHeight: 1, marginTop: 4 }}>
            {fmtARS(totalArsMes)}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center" }}>
            <span className="chip green">
              {delta < 0 ? "↓" : "↑"} {Math.abs(delta)}% vs marzo
            </span>
            <span className="t-hand" style={{ color: "var(--ink-3)" }}>
              <span className="wiggle">Promedio diario:</span> {fmtARS(totalArsMes / 20)}
            </span>
          </div>
          <div style={{ position: "absolute", top: -14, right: 30 }}>
            <div className="tape" style={{ transform: "rotate(6deg)" }} />
          </div>
        </div>

        <KPICard
          label="Pendiente aprobar"
          value={fmtARS(pendienteArs)}
          sub={`${pendientes.length} mails detectados`}
          accent="yellow"
        />
        <KPICard
          label="Vence esta semana"
          value={`${vencenEstaSemana.length} facturas`}
          sub={fmtARS(vencenEstaSemana.reduce((s, e) => s + e.amount_cents / 100, 0))}
          accent="red"
        />
        <KPICard label="Ahorro posible" value={fmtARS(8780)} sub="2 subs sin usar" accent="green" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        <div
          className="paper-plain"
          style={{ padding: 22, border: "2px solid #1a1a1a", borderRadius: 14 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "end",
              marginBottom: 8,
            }}
          >
            <div>
              <div className="section-title">Evolución · últimos 7 meses</div>
              <div className="t-hand" style={{ color: "var(--ink-3)", fontSize: 14 }}>
                en pesos · tendencia <span className="hl-green">bajando</span> desde dic
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="chip yellow">mes</span>
              <span className="chip">3M</span>
              <span className="chip">6M</span>
              <span className="chip">1A</span>
            </div>
          </div>
          <SketchyLineChart data={HISTORICO} w={620} h={240} />
        </div>

        <div
          className="paper-plain"
          style={{ padding: 22, border: "2px solid #1a1a1a", borderRadius: 14 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <div>
              <div className="section-title">Pendientes de aprobar</div>
              <div className="t-hand" style={{ color: "var(--ink-3)", fontSize: 14 }}>
                el bot te avisa por Telegram →
              </div>
            </div>
            <span className="chip red">{pendientes.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendientes.slice(0, 5).map((e) => (
              <PendienteRow key={e.id} e={e} />
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          marginTop: 18,
        }}
      >
        <div
          className="paper-plain"
          style={{ padding: 22, border: "2px solid #1a1a1a", borderRadius: 14 }}
        >
          <div className="section-title">Por categoría</div>
          <SketchyBars items={catItems} max={maxCat} h={220} w={520} />
        </div>

        <div
          className="paper-plain"
          style={{ padding: 22, border: "2px solid #1a1a1a", borderRadius: 14 }}
        >
          <div className="section-title">Alertas & insights</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            {insights.map((ins) => (
              <InsightCard key={ins.id} ins={ins} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
