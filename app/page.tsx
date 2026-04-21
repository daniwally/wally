import Link from "next/link";
import {
  CATEGORIAS,
  HISTORICO,
  MES_ACTUAL,
  USD_RATE,
  type CategoriaKey,
} from "@/lib/mock-data";
import { fmtARS, fmtUSD } from "@/lib/format";
import { getDashboardData } from "@/lib/data";
import { SketchyLineChart } from "@/components/charts/SketchyLineChart";
import { SketchyBars } from "@/components/charts/SketchyBars";
import { SketchyDonut } from "@/components/charts/SketchyDonut";
import { KPICard } from "@/components/dashboard/KPICard";
import { PendienteRow } from "@/components/dashboard/PendienteRow";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { Timeline } from "@/components/novel/Timeline";
import { StickyBill } from "@/components/novel/StickyBill";
import { MarginNote } from "@/components/novel/MarginNote";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ view?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { view = "classic" } = await searchParams;
  const data = await getDashboardData();

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 12 }}>
        <Link
          href="/?view=classic"
          className={`chip ${view === "classic" ? "yellow" : ""}`}
          style={{ textDecoration: "none" }}
        >
          classic
        </Link>
        <Link
          href="/?view=novel"
          className={`chip ${view === "novel" ? "yellow" : ""}`}
          style={{ textDecoration: "none" }}
        >
          novel
        </Link>
      </div>

      {view === "novel" ? <NovelView data={data} /> : <ClassicView data={data} />}
    </>
  );
}

type Data = Awaited<ReturnType<typeof getDashboardData>>;

function ClassicView({ data }: { data: Data }) {
  const { pendientes, pagados, insights, totalArsMes, pendienteArs } = data;

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
        className="r-grid"
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

      <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
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

      <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
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
          <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            {insights.map((ins) => (
              <InsightCard key={ins.id} ins={ins} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NovelView({ data }: { data: Data }) {
  const { pendientes, pagados, insights, totalArsMes, pendienteArs } = data;

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

  const hoy = 20;
  const diasMes = 30;
  const eventosTimeline = [
    ...pagados
      .filter((e) => e.paid_at && e.category_id)
      .map((e) => ({
        id: e.id,
        dia: new Date(e.paid_at!).getUTCDate(),
        nombre: e.provider,
        monto: e.amount_cents / 100,
        pagado: true,
        cat: e.category_id as CategoriaKey,
      })),
    ...pendientes
      .filter((e) => e.due_at && e.currency === "ARS" && e.category_id)
      .map((e) => ({
        id: e.id,
        dia: new Date(e.due_at! + "T00:00").getUTCDate(),
        nombre: e.provider,
        monto: e.amount_cents / 100,
        pagado: false,
        cat: e.category_id as CategoriaKey,
      })),
  ].sort((a, b) => a.dia - b.dia);

  const pendingLabels = pendientes
    .filter((p) => p.due_at)
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      proveedor: p.provider,
      monto: p.amount_cents / 100,
      dia: new Date(p.due_at! + "T00:00").getUTCDate(),
    }));

  return (
    <div style={{ padding: "0 4px", position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
          padding: "0 12px",
        }}
      >
        <div>
          <div
            className="t-title"
            style={{ fontSize: 88, lineHeight: 0.85, letterSpacing: "-0.02em" }}
          >
            {fmtARS(totalArsMes)}
          </div>
          <div className="t-hand" style={{ fontSize: 18, color: "var(--ink-2)", marginTop: 6 }}>
            gastado en <span className="hl">{MES_ACTUAL}</span> · faltan <b>{diasMes - hoy} días</b>{" "}
            del mes · quedan <span className="wiggle-red wiggle">{fmtARS(pendienteArs)}</span> por
            pagar
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="t-hand"
            style={{
              fontSize: 13,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            dólar blue hoy
          </div>
          <div className="t-title" style={{ fontSize: 28 }}>
            ${USD_RATE}
          </div>
          <div className="t-hand" style={{ fontSize: 13, color: "var(--ink-3)" }}>
            equivale a {fmtUSD(totalArsMes / USD_RATE)}
          </div>
        </div>
      </div>

      <hr className="scribble" />

      <div style={{ position: "relative", padding: "20px 12px 60px", marginBottom: 8 }}>
        <div className="section-title" style={{ marginBottom: 4 }}>
          Calendario de abril
        </div>
        <div className="t-hand" style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 26 }}>
          cada marca es un gasto · los{" "}
          <span style={{ color: "var(--red)", fontWeight: 700 }}>rojos</span> son los que vienen
        </div>
        <Timeline hoy={hoy} diasMes={diasMes} eventos={eventosTimeline} pendingLabels={pendingLabels} />
      </div>

      <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, padding: "0 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className="tab-index">01</span>
              <div className="section-title">En perspectiva</div>
            </div>
            <div style={{ position: "relative", marginTop: 8 }}>
              <SketchyLineChart data={HISTORICO} w={620} h={220} />
              <div
                className="sticky sticky-pink"
                style={{
                  position: "absolute",
                  top: -10,
                  right: 10,
                  maxWidth: 180,
                  transform: "rotate(3deg)",
                  fontSize: 14,
                }}
              >
                <b>Nota:</b> diciembre = regalos navidad + aguinaldo gastado 😅
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className="tab-index">02</span>
              <div className="section-title">Dónde se va la plata</div>
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 8 }}>
              <SketchyDonut
                items={catItems.slice(0, 6).map((c) => ({
                  value: c.value,
                  color: c.color,
                  stroke: c.stroke,
                }))}
                size={200}
              />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {catItems.slice(0, 6).map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 16,
                        height: 16,
                        background: c.color,
                        border: "1.8px solid #1a1a1a",
                        borderRadius: 4,
                      }}
                    />
                    <span className="t-hand" style={{ fontSize: 15, flex: 1 }}>
                      {c.label}
                    </span>
                    <span className="t-hand" style={{ fontSize: 15, fontWeight: 700 }}>
                      {fmtARS(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="tab-index">03</span>
            <div className="section-title">Buzón del bot</div>
          </div>
          <div className="t-hand" style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 12 }}>
            decile <span className="hl-green">ok</span> o <span className="hl-red">no</span> a cada
            uno
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}
          >
            {pendientes.slice(0, 4).map((e, i) => (
              <StickyBill key={e.id} e={e} idx={i} />
            ))}
          </div>
        </div>
      </div>

      <hr className="scribble" />

      <div style={{ padding: "8px 12px 24px" }}>
        <div className="section-title">Lo que notó el bot esta semana</div>
        <div
          className="r-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 18,
            marginTop: 12,
          }}
        >
          {insights.map((ins, i) => (
            <MarginNote key={ins.id} ins={ins} idx={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
