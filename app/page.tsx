import { type CategoriaKey, CATEGORIAS } from "@/lib/mock-data";
import { fmtARS, fmtMoney } from "@/lib/format";
import { getDashboardData } from "@/lib/data";
import { CAT_COLOR, CAT_ICON, Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { KPI } from "@/components/v2/KPI";
import { LineChart } from "@/components/v2/LineChart";
import { TimelineV2 } from "@/components/v2/TimelineV2";
import { DonutV2 } from "@/components/v2/DonutV2";
import { PendRow } from "@/components/v2/PendRow";
import { V2Insight } from "@/components/v2/InsightCard";
import { MonthSelector } from "@/components/v2/MonthSelector";
import { ExpensesTable } from "@/components/v2/ExpensesTable";
import Link from "next/link";

export const dynamic = "force-dynamic";

const MES_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

type SearchParams = Promise<{ mes?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { mes } = await searchParams;
  const validMes = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : undefined;

  const { pendientes, pagados, insights, historico, months, totalArsMes, pendienteArs } =
    await getDashboardData(validMes);

  const now = new Date();
  const currentMes = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const selectedMes = validMes ?? currentMes;
  const isCurrentMonth = selectedMes === currentMes;

  const monthOptions = months.map((m) => {
    const [y, mm] = m.split("-").map(Number);
    return {
      value: m,
      label: `${MES_LABELS[mm - 1]} ${y}`,
    };
  });

  const [selY, selM] = selectedMes.split("-").map(Number);
  const selMonthLabel = `${MES_LABELS[selM - 1]} ${selY}`;

  const cats: Partial<Record<CategoriaKey, number>> = {};
  [...pagados, ...pendientes.filter((p) => p.currency === "ARS")].forEach((e) => {
    if (!e.category_id) return;
    const k = e.category_id as CategoriaKey;
    cats[k] = (cats[k] || 0) + e.amount_cents / 100;
  });

  const catItems = (Object.entries(cats) as [CategoriaKey, number][])
    .map(([k, v]) => ({
      key: k,
      label: CATEGORIAS[k].label,
      value: v,
      color: CAT_COLOR[k] ?? "#737373",
    }))
    .sort((a, b) => b.value - a.value);

  const prevPoint = historico[historico.length - 2];
  const totalPrev = prevPoint?.total ?? 0;
  const delta =
    totalPrev > 0 ? Math.round(((totalArsMes - totalPrev) / totalPrev) * 100) : null;
  const prevLabel = prevPoint ? prevPoint.mes : "mes anterior";
  const hasHistory = historico.some((h) => h.total > 0);

  const hoy = isCurrentMonth ? now.getUTCDate() : -1;
  const diasMes = new Date(Date.UTC(selY, selM, 0)).getUTCDate();

  const eventosTimeline = [
    ...pagados
      .filter((e) => e.paid_at && e.category_id)
      .map((e) => ({
        dia: new Date(e.paid_at!).getUTCDate(),
        monto: e.amount_cents / 100,
        pagado: true,
        cat: e.category_id!,
        nombre: e.provider,
      })),
    ...(isCurrentMonth
      ? pendientes
          .filter((e) => e.due_at && e.currency === "ARS" && e.category_id)
          .filter((e) => {
            const d = new Date(e.due_at! + "T00:00");
            return d.getUTCMonth() === selM - 1 && d.getUTCFullYear() === selY;
          })
          .map((e) => ({
            dia: new Date(e.due_at! + "T00:00").getUTCDate(),
            monto: e.amount_cents / 100,
            pagado: false,
            cat: e.category_id!,
            nombre: e.provider,
          }))
      : []),
  ];

  const vencenEstaSemana = pendientes.filter((e) => {
    if (!e.due_at || e.currency !== "ARS") return false;
    const d = new Date(e.due_at + "T00:00");
    const diff = (d.getTime() - now.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  });

  const totalCat = catItems.reduce((s, c) => s + c.value, 0);

  // Breakdown de tarjetas de crédito por proveedor (banco + tarjeta)
  const tarjetasMap = new Map<string, number>();
  pagados
    .filter((e) => e.category_id === "tarjeta" && e.currency === "ARS")
    .forEach((e) => {
      const key = e.provider.trim();
      tarjetasMap.set(key, (tarjetasMap.get(key) ?? 0) + e.amount_cents / 100);
    });
  const tarjetasItems = Array.from(tarjetasMap.entries())
    .map(([provider, value]) => ({ provider, value }))
    .sort((a, b) => b.value - a.value);
  const totalTarjetas = tarjetasItems.reduce((s, t) => s + t.value, 0);

  // Breakdown de débitos/bancos/préstamos
  const bancosMap = new Map<string, number>();
  pagados
    .filter(
      (e) =>
        (e.category_id === "debito" || e.category_id === "prestamo") &&
        e.currency === "ARS",
    )
    .forEach((e) => {
      const prefix = e.category_id === "prestamo" ? "Préstamo · " : "Débito · ";
      const key = prefix + e.provider.trim();
      bancosMap.set(key, (bancosMap.get(key) ?? 0) + e.amount_cents / 100);
    });
  const bancosItems = Array.from(bancosMap.entries())
    .map(([provider, value]) => ({ provider, value }))
    .sort((a, b) => b.value - a.value);
  const totalBancos = bancosItems.reduce((s, b) => s + b.value, 0);

  return (
    <>
      <PageHeader
        section="Panel"
        title="Dashboard Wally"
        right={
          <>
            <MonthSelector current={selectedMes} options={monthOptions} />
            <div style={{ width: 1, height: 22, background: "var(--border)" }} />
            <Link href="/nuevo" className="v2-btn primary">
              <Icon.plus /> Nuevo gasto
            </Link>
          </>
        }
      />

      <div className="v2-content">
        <div className="v2-grid v2-grid-hero" style={{ marginBottom: 20 }}>
          <div className="v2-card">
            <div className="v2-card-header">
              <div>
                <div className="v2-card-title">Gastado en {selMonthLabel.toLowerCase()}</div>
                <div className="v2-kpi-value hero" style={{ marginTop: 8 }}>
                  {fmtARS(totalArsMes)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {delta !== null && (
                <span className={`v2-kpi-delta ${delta < 0 ? "down" : "up"}`}>
                  {delta < 0 ? "↓" : "↑"} {Math.abs(delta)}% vs {prevLabel}
                </span>
              )}
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                · prom. diario {fmtARS(totalArsMes / 20)}
              </span>
            </div>
          </div>

          <KPI
            title="Pendiente total"
            value={fmtARS(pendienteArs)}
            sub={`${pendientes.length} detectados`}
            trend="flat"
            trendLabel="sin revisar"
          />
          <KPI
            title={isCurrentMonth ? "Vence esta semana" : "Pendientes ver"}
            value={isCurrentMonth ? `${vencenEstaSemana.length} facturas` : `${pendientes.length}`}
            sub={
              isCurrentMonth
                ? fmtARS(vencenEstaSemana.reduce((s, e) => s + e.amount_cents / 100, 0))
                : "en total"
            }
            trend={isCurrentMonth && vencenEstaSemana.length > 0 ? "up" : "flat"}
            trendLabel={isCurrentMonth && vencenEstaSemana.length > 0 ? "urgente" : "ok"}
          />
          <KPI
            title="Categorías activas"
            value={String(catItems.length)}
            sub="este mes"
            trend="flat"
          />
        </div>

        <div className="v2-grid v2-grid-2-asym" style={{ marginBottom: 16 }}>
          <div className="v2-card">
            <div className="v2-card-header">
              <div>
                <div className="v2-card-title">Evolución</div>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                  Últimos 7 meses · solo gastos pagados
                </div>
              </div>
            </div>
            {hasHistory ? (
              <LineChart data={historico} />
            ) : (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "var(--text-3)",
                  fontSize: 13,
                }}
              >
                Todavía no hay historial. A medida que apruebes gastos como pagados, va a
                aparecer la evolución mes a mes acá.
              </div>
            )}
          </div>

          <div className="v2-card" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                padding: "20px 20px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div className="v2-card-title">Pendientes de aprobar</div>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                  Wally detectó estos gastos
                </div>
              </div>
              <span className="v2-badge red">
                <span className="dot" />
                {pendientes.length}
              </span>
            </div>
            <div style={{ borderTop: "1px solid var(--border)" }}>
              {pendientes.length === 0 ? (
                <div style={{ padding: 20, color: "var(--text-3)", fontSize: 13 }}>
                  No hay pendientes por ahora.
                </div>
              ) : (
                pendientes.slice(0, 5).map((p, i) => (
                  <PendRow key={p.id} e={p} last={i === Math.min(4, pendientes.length - 1)} />
                ))
              )}
            </div>
            <Link
              href="/pendientes"
              style={{
                padding: "10px 20px",
                borderTop: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--text-3)",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Ver los {pendientes.length} pendientes →
            </Link>
          </div>
        </div>

        <div className="v2-card" style={{ marginBottom: 16 }}>
          <div className="v2-card-header">
            <div>
              <div className="v2-card-title">Calendario de {selMonthLabel.toLowerCase()}</div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                Gastos diarios
                {isCurrentMonth && (
                  <>
                    {" · "}
                    <span style={{ color: "var(--accent)" }}>hoy es {hoy}</span>
                  </>
                )}
                {" · punteado = pendiente"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--text-3)", flexWrap: "wrap" }}>
              {Object.entries(CATEGORIAS)
                .slice(0, 5)
                .map(([k, c]) => (
                  <span key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                      className="v2-cat-dot"
                      style={{ background: CAT_COLOR[k] ?? "#737373" }}
                    />
                    {c.label}
                  </span>
                ))}
            </div>
          </div>
          <TimelineV2 eventos={eventosTimeline} diasMes={diasMes} hoy={hoy} />
        </div>

        <div className="v2-grid v2-grid-2" style={{ marginBottom: 16 }}>
          {/* Tarjetas de crédito */}
          <div className="v2-card">
            <div className="v2-card-header">
              <div>
                <div className="v2-card-title">Tarjetas de crédito</div>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                  Por banco y tarjeta · {selMonthLabel.toLowerCase()}
                </div>
              </div>
              <span
                className="v2-badge"
                style={{ background: "var(--red-soft)", color: "var(--red)" }}
              >
                {fmtARS(totalTarjetas)}
              </span>
            </div>
            {tarjetasItems.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-3)",
                  padding: "10px 0",
                }}
              >
                Sin resúmenes pagados este mes.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tarjetasItems.map((t) => {
                  const pct = totalTarjetas > 0 ? (t.value / totalTarjetas) * 100 : 0;
                  return (
                    <div key={t.provider}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: 4,
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.provider}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                        >
                          {fmtARS(t.value)}
                        </span>
                      </div>
                      <div className="v2-progress">
                        <div
                          style={{
                            width: `${pct}%`,
                            background: "#dc2626",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bancos / Débitos */}
          <div className="v2-card">
            <div className="v2-card-header">
              <div>
                <div className="v2-card-title">Bancos · Débitos · Préstamos</div>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                  Débitos automáticos y cuotas de préstamos · {selMonthLabel.toLowerCase()}
                </div>
              </div>
              <span className="v2-badge">{fmtARS(totalBancos)}</span>
            </div>
            {bancosItems.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-3)",
                  padding: "10px 0",
                }}
              >
                Sin débitos bancarios este mes.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {bancosItems.map((b) => {
                  const pct = totalBancos > 0 ? (b.value / totalBancos) * 100 : 0;
                  return (
                    <div key={b.provider}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: 4,
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {b.provider}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                        >
                          {fmtARS(b.value)}
                        </span>
                      </div>
                      <div className="v2-progress">
                        <div
                          style={{
                            width: `${pct}%`,
                            background: "#737373",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="v2-grid v2-grid-2">
          <div className="v2-card">
            <div className="v2-card-header">
              <div className="v2-card-title">Por categoría</div>
              <span className="v2-badge outline">{selMonthLabel.toLowerCase()}</span>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <DonutV2
                items={catItems.slice(0, 6).map((c) => ({ value: c.value, color: c.color }))}
                size={170}
              />
              <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 10 }}>
                {catItems.slice(0, 6).map((c) => (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="v2-cat-dot" style={{ background: c.color }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{c.label}</span>
                    <span
                      style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}
                    >
                      {fmtARS(c.value)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-3)",
                        fontVariantNumeric: "tabular-nums",
                        width: 36,
                        textAlign: "right",
                      }}
                    >
                      {totalCat > 0 ? Math.round((c.value / totalCat) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="v2-card">
            <div className="v2-card-header">
              <div className="v2-card-title">Insights esta semana</div>
              <span className="v2-badge">{insights.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {insights.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-3)" }}>
                  Todavía no hay insights. Van a aparecer a medida que detectemos patrones.
                </div>
              ) : (
                insights.map((ins) => <V2Insight key={ins.id} ins={ins} />)
              )}
            </div>
          </div>
        </div>

        {/* Listado de gastos del mes */}
        <div className="v2-card" style={{ marginTop: 16, padding: 0 }}>
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--border)",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div className="v2-card-title">Gastos de {selMonthLabel.toLowerCase()}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                {pagados.length} {pagados.length === 1 ? "gasto" : "gastos"} pagados · total{" "}
                {fmtARS(totalArsMes)}
              </div>
            </div>
            <Link href="/mail?filter=paid" className="v2-btn">
              Ver todos
            </Link>
          </div>

          {pagados.length === 0 ? (
            <div
              style={{
                padding: "30px 20px",
                fontSize: 13,
                color: "var(--text-3)",
                textAlign: "center",
              }}
            >
              Todavía no hay gastos pagados en {selMonthLabel.toLowerCase()}. A medida que
              apruebes pendientes o subas manualmente, aparecen acá.
            </div>
          ) : (
            <ExpensesTable expenses={pagados} />
          )}
        </div>
      </div>
    </>
  );
}
