import {
  MES_ACTUAL,
  PENDIENTES,
  PAGADOS_MES,
  HISTORICO,
  INSIGHTS,
  CATEGORIAS,
  TOTAL_ARS_MES,
  PENDIENTE_ARS,
  type CategoriaKey,
} from "@/lib/mock-data";
import { fmtARS } from "@/lib/format";
import { SketchyLineChart } from "@/components/charts/SketchyLineChart";
import { SketchyBars } from "@/components/charts/SketchyBars";
import { KPICard } from "@/components/dashboard/KPICard";
import { PendienteRow } from "@/components/dashboard/PendienteRow";
import { InsightCard } from "@/components/dashboard/InsightCard";

export default function DashboardPage() {
  const cats: Partial<Record<CategoriaKey, number>> = {};
  PAGADOS_MES.forEach((g) => {
    cats[g.cat] = (cats[g.cat] || 0) + g.monto;
  });
  PENDIENTES.filter((p) => p.moneda === "ARS").forEach((g) => {
    cats[g.cat] = (cats[g.cat] || 0) + g.monto;
  });

  const catItems = (Object.entries(cats) as [CategoriaKey, number][])
    .map(([k, v]) => ({
      label: CATEGORIAS[k].label,
      value: v,
      color: CATEGORIAS[k].soft,
      stroke: CATEGORIAS[k].color,
    }))
    .sort((a, b) => b.value - a.value);

  const maxCat = Math.max(...catItems.map((i) => i.value));
  const totalPrev = HISTORICO[5].total;
  const delta = Math.round(((TOTAL_ARS_MES - totalPrev) / totalPrev) * 100);

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
            {fmtARS(TOTAL_ARS_MES)}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center" }}>
            <span className="chip green">
              {delta < 0 ? "↓" : "↑"} {Math.abs(delta)}% vs marzo
            </span>
            <span className="t-hand" style={{ color: "var(--ink-3)" }}>
              <span className="wiggle">Promedio diario:</span> {fmtARS(TOTAL_ARS_MES / 20)}
            </span>
          </div>
          <div style={{ position: "absolute", top: -14, right: 30 }}>
            <div className="tape" style={{ transform: "rotate(6deg)" }} />
          </div>
        </div>

        <KPICard
          label="Pendiente aprobar"
          value={fmtARS(PENDIENTE_ARS)}
          sub={`${PENDIENTES.length} mails detectados`}
          accent="yellow"
        />
        <KPICard
          label="Vence esta semana"
          value="3 facturas"
          sub={fmtARS(24580 + 11990 + 412350)}
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
            <span className="chip red">{PENDIENTES.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PENDIENTES.slice(0, 5).map((p) => (
              <PendienteRow key={p.id} p={p} />
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
            {INSIGHTS.map((ins, i) => (
              <InsightCard key={i} ins={ins} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
