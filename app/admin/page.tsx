import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { fmtARS } from "@/lib/format";
import { CAT_COLOR, Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
import { Toggle } from "@/components/v2/Toggle";
import {
  addRule,
  removeRule,
  triggerScan,
  setBudget,
  removeBudget,
  createRuleFromExpense,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const { ok, error } = await searchParams;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

  const [
    { data: accounts },
    { data: rules },
    { data: budgets },
    { data: paidThisMonth },
    { data: unruledExpenses },
  ] = await Promise.all([
    supabase()
      .from("accounts")
      .select("id, type, account, status, last_scan_at, created_at")
      .eq("user_id", WALLY_USER_ID)
      .order("created_at", { ascending: false }),
    supabase()
      .from("rules")
      .select("id, sender_pattern, provider, category_id, auto_approve, active, hits")
      .eq("user_id", WALLY_USER_ID)
      .order("created_at", { ascending: false }),
    supabase()
      .from("budgets")
      .select("id, category_id, amount_cents, currency")
      .eq("user_id", WALLY_USER_ID)
      .eq("period", "month"),
    supabase()
      .from("expenses")
      .select("category_id, amount_cents, currency")
      .eq("user_id", WALLY_USER_ID)
      .in("status", ["paid", "auto_approved", "pending_approval"])
      .or(
        `and(paid_at.gte.${monthStart},paid_at.lt.${monthEnd}),and(paid_at.is.null,detected_at.gte.${monthStart},detected_at.lt.${monthEnd})`,
      ),
    supabase()
      .from("expenses")
      .select("id, provider, amount_cents, currency, category_id, source_from, detected_at")
      .eq("user_id", WALLY_USER_ID)
      .is("rule_id", null)
      .in("status", ["pending_approval"])
      .order("detected_at", { ascending: false }),
  ]);

  const spentByCat: Record<string, number> = {};
  (paidThisMonth ?? [])
    .filter((e) => e.currency === "ARS" && e.category_id)
    .forEach((e) => {
      spentByCat[e.category_id!] = (spentByCat[e.category_id!] ?? 0) + e.amount_cents / 100;
    });

  const suggestionsBySender = new Map<
    string,
    {
      sender: string;
      count: number;
      firstExpenseId: string;
      firstProvider: string;
      firstCatId: string | null;
    }
  >();
  (unruledExpenses ?? []).forEach((e) => {
    const from = e.source_from ?? "desconocido";
    const existing = suggestionsBySender.get(from);
    if (existing) {
      existing.count++;
    } else {
      suggestionsBySender.set(from, {
        sender: from,
        count: 1,
        firstExpenseId: e.id,
        firstProvider: e.provider,
        firstCatId: e.category_id,
      });
    }
  });
  const suggestions = Array.from(suggestionsBySender.values());

  const gmails = (accounts ?? []).filter((a) => a.type === "gmail");

  return (
    <>
      <PageHeader
        section="Configuración"
        title="Cuentas & Reglas"
        right={
          <form action={triggerScan}>
            <button type="submit" className="v2-btn primary">
              <Icon.sparkle /> Escanear ahora
            </button>
          </form>
        }
      />

      <div className="v2-content">
        {ok && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 16,
              border: "1px solid var(--green)",
              background: "var(--green-soft)",
              color: "var(--green)",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            ✓ Gmail conectado: <strong>{decodeURIComponent(ok)}</strong>
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 16,
              border: "1px solid var(--red)",
              background: "var(--red-soft)",
              color: "var(--red)",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            ⚠ Error: {decodeURIComponent(error)}
          </div>
        )}

        {/* Cuentas */}
        <div className="v2-card" style={{ marginBottom: 16 }}>
          <div className="v2-card-header">
            <div>
              <div className="v2-card-title">Cuentas conectadas</div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                Fuentes que Wally monitorea
              </div>
            </div>
            <a href="/api/auth/google/start" className="v2-btn primary">
              <Icon.plus /> Conectar Gmail
            </a>
          </div>

          {gmails.length === 0 ? (
            <div style={{ color: "var(--text-3)", fontSize: 13, padding: "8px 0" }}>
              No hay cuentas conectadas.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {gmails.map((a) => (
                <div
                  key={a.id}
                  style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      className="v2-avatar"
                      style={{ background: "var(--red-soft)", color: "var(--red)" }}
                    >
                      <Icon.mail />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text-3)" }}>Gmail</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {a.account}
                      </div>
                    </div>
                    <span className={`v2-badge ${a.status === "ok" ? "green" : "red"}`}>
                      <span className="dot" />
                      {a.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 10 }}>
                    {a.last_scan_at
                      ? `último scan: ${new Date(a.last_scan_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}`
                      : "sin scan todavía"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sugerencias */}
        {suggestions.length > 0 && (
          <div
            className="v2-card"
            style={{
              marginBottom: 16,
              background: "var(--blue-soft)",
              borderColor: "var(--blue)",
            }}
          >
            <div className="v2-card-header">
              <div>
                <div
                  className="v2-card-title"
                  style={{ color: "var(--blue)", display: "flex", gap: 6, alignItems: "center" }}
                >
                  <Icon.sparkle /> Sugerencias del bot
                </div>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>
                  Claude detectó gastos de remitentes sin regla. Convertí en regla con un click.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {suggestions.map((s) => {
                const cat = (s.firstCatId ?? "servicios") as CategoriaKey;
                const catInfo = CATEGORIAS[cat];
                return (
                  <div
                    key={s.sender}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                    }}
                  >
                    <span
                      className="v2-cat-dot"
                      style={{ background: CAT_COLOR[cat] ?? "#737373", width: 10, height: 10 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {s.firstProvider}{" "}
                        <span style={{ color: "var(--text-3)", fontWeight: 400 }}>
                          · {catInfo.label} · {s.count} gasto{s.count > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-3)",
                          fontFamily: "var(--mono)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {s.sender}
                      </div>
                    </div>
                    <form action={createRuleFromExpense}>
                      <input type="hidden" name="expense_id" value={s.firstExpenseId} />
                      <button type="submit" className="v2-btn sm primary">
                        <Icon.plus /> Crear regla
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="v2-grid v2-grid-admin">
          {/* Reglas */}
          <div className="v2-card" style={{ padding: 0 }}>
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <div className="v2-card-title">Reglas de parsing</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  {(rules ?? []).length} activas · cada 15min el cron las corre
                </div>
              </div>
            </div>

            <form
              action={addRule}
              style={{
                padding: "14px 20px",
                display: "grid",
                gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr) minmax(0, 1fr) auto auto",
                gap: 8,
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <input
                name="sender"
                placeholder="e-resumen@banco.com.ar"
                required
                className="v2-input"
                style={{ fontFamily: "var(--mono)", fontSize: 12 }}
              />
              <input
                name="provider"
                placeholder="Proveedor (opcional)"
                className="v2-input"
              />
              <select name="category" defaultValue="servicios" className="v2-select">
                {Object.entries(CATEGORIAS).map(([k, c]) => (
                  <option key={k} value={k}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label
                style={{
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "var(--text-3)",
                }}
              >
                <input type="checkbox" name="auto_approve" /> auto
              </label>
              <button type="submit" className="v2-btn primary">
                <Icon.plus /> Agregar
              </button>
            </form>

            {!rules || rules.length === 0 ? (
              <div style={{ padding: 20, color: "var(--text-3)", fontSize: 13 }}>
                No hay reglas todavía. Agregá remitentes arriba o aceptá sugerencias.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th>Remitente</th>
                      <th>Proveedor</th>
                      <th>Categoría</th>
                      <th>Auto</th>
                      <th style={{ textAlign: "right" }}>Usos</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => {
                      const cat = (r.category_id ?? "servicios") as CategoriaKey;
                      const catInfo = CATEGORIAS[cat];
                      return (
                        <tr key={r.id}>
                          <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                            {r.sender_pattern}
                          </td>
                          <td style={{ fontWeight: 500 }}>{r.provider ?? "—"}</td>
                          <td>
                            <span className="v2-badge">
                              <span
                                className="v2-cat-dot"
                                style={{ background: CAT_COLOR[cat] ?? "#737373" }}
                              />
                              {catInfo.label}
                            </span>
                          </td>
                          <td>
                            <Toggle on={!!r.auto_approve} />
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontFamily: "var(--mono)",
                              fontSize: 12,
                            }}
                          >
                            {r.hits ?? 0}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <form action={removeRule}>
                              <input type="hidden" name="id" value={r.id} />
                              <button
                                type="submit"
                                className="v2-btn sm ghost"
                                title="Eliminar"
                              >
                                <Icon.trash />
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Presupuestos */}
          <div className="v2-card">
            <div className="v2-card-header">
              <div className="v2-card-title">Presupuestos mensuales</div>
            </div>
            <form
              action={setBudget}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <select name="category" defaultValue="servicios" className="v2-select">
                {Object.entries(CATEGORIAS).map(([k, c]) => (
                  <option key={k} value={k}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                name="amount"
                type="number"
                min="0"
                step="1000"
                placeholder="ARS"
                required
                className="v2-input"
              />
              <button type="submit" className="v2-btn primary">
                Guardar
              </button>
            </form>

            {!budgets || budgets.length === 0 ? (
              <div style={{ color: "var(--text-3)", fontSize: 13 }}>Sin presupuestos.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {budgets
                  .slice()
                  .sort((a, b) => (a.category_id ?? "").localeCompare(b.category_id ?? ""))
                  .map((b) => {
                    const cat = (b.category_id ?? "servicios") as CategoriaKey;
                    const catInfo = CATEGORIAS[cat];
                    const budget = b.amount_cents / 100;
                    const spent = spentByCat[cat] ?? 0;
                    const pct = Math.min(100, (spent / budget) * 100);
                    const over = spent > budget;
                    const color = over
                      ? "var(--red)"
                      : pct >= 80
                        ? "var(--amber)"
                        : CAT_COLOR[cat] ?? "var(--text)";
                    return (
                      <div key={b.id}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 5,
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12.5,
                              fontWeight: 500,
                            }}
                          >
                            <span
                              className="v2-cat-dot"
                              style={{ background: CAT_COLOR[cat] ?? "#737373" }}
                            />
                            {catInfo.label}
                          </span>
                          <span
                            style={{
                              fontSize: 11.5,
                              color: "var(--text-3)",
                              fontVariantNumeric: "tabular-nums",
                              flex: 1,
                              textAlign: "right",
                            }}
                          >
                            {fmtARS(spent)} / {fmtARS(budget)}
                          </span>
                          <form action={removeBudget}>
                            <input type="hidden" name="id" value={b.id} />
                            <button
                              type="submit"
                              className="v2-btn sm ghost"
                              style={{ padding: "2px 6px" }}
                              title="Eliminar"
                            >
                              <Icon.x />
                            </button>
                          </form>
                        </div>
                        <div className="v2-progress">
                          <div style={{ width: pct + "%", background: color }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
