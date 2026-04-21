import { supabase, WALLY_USER_ID } from "@/lib/supabase";
import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import { addRule, removeRule, triggerScan } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const { ok, error } = await searchParams;

  const [{ data: accounts }, { data: rules }] = await Promise.all([
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
  ]);

  const gmails = (accounts ?? []).filter((a) => a.type === "gmail");

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">Cuentas, remitentes a monitorear y configuración</p>
      </div>

      {ok && (
        <div
          className="sticky sticky-green"
          style={{ marginBottom: 20, display: "inline-block" }}
        >
          ✓ Gmail conectado: <strong>{decodeURIComponent(ok)}</strong>
        </div>
      )}
      {error && (
        <div
          className="sticky sticky-pink"
          style={{ marginBottom: 20, display: "inline-block" }}
        >
          ⚠ Error: {decodeURIComponent(error)}
        </div>
      )}

      {/* Cuentas conectadas */}
      <div
        className="paper-plain"
        style={{
          padding: 22,
          border: "2px solid #1a1a1a",
          borderRadius: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div className="section-title">Cuentas de Gmail</div>
          <a href="/api/auth/google/start" className="btn-sketch primary">
            + Conectar Gmail
          </a>
        </div>

        {gmails.length === 0 ? (
          <div
            className="t-hand"
            style={{ color: "var(--ink-3)", padding: "16px 0", fontSize: 15 }}
          >
            No hay cuentas conectadas. Clickeá <strong>Conectar Gmail</strong> para empezar.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {gmails.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  border: "1.5px solid #1a1a1a",
                  borderRadius: 10,
                  background: "var(--paper-2)",
                }}
              >
                <div style={{ fontSize: 22 }}>📧</div>
                <div style={{ flex: 1 }}>
                  <div className="t-hand" style={{ fontWeight: 700, fontSize: 16 }}>
                    {a.account}
                  </div>
                  <div
                    className="t-hand"
                    style={{ fontSize: 13, color: "var(--ink-3)" }}
                  >
                    {a.status === "ok" ? "● conectada" : `● ${a.status}`}
                    {a.last_scan_at && (
                      <>
                        {" · último scan: "}
                        {new Date(a.last_scan_at).toLocaleString("es-AR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </>
                    )}
                  </div>
                </div>
                <span className={`chip ${a.status === "ok" ? "green" : "red"}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remitentes a monitorear */}
      <div
        className="paper-plain"
        style={{
          padding: 22,
          border: "2px solid #1a1a1a",
          borderRadius: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
          }}
        >
          <div>
            <div className="section-title">Remitentes a monitorear</div>
            <div className="t-hand" style={{ fontSize: 14, color: "var(--ink-3)" }}>
              Agregá los emails que te mandan facturas. El cron solo escanea estos.
            </div>
          </div>
          <form action={triggerScan}>
            <button className="btn-sketch" type="submit">
              ⟳ Escanear ahora
            </button>
          </form>
        </div>

        <form
          action={addRule}
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.2fr 1fr auto auto",
            gap: 10,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <input
            name="sender"
            placeholder="e-resumen@mensajesgalicia.com.ar"
            required
            style={{
              fontFamily: "var(--mono)",
              fontSize: 13,
              padding: "10px 12px",
              border: "1.5px solid var(--ink)",
              borderRadius: 8,
              background: "var(--paper)",
            }}
          />
          <input
            name="provider"
            placeholder="Visa Galicia (opcional)"
            style={{
              fontFamily: "var(--hand)",
              fontSize: 14,
              padding: "10px 12px",
              border: "1.5px solid var(--ink)",
              borderRadius: 8,
              background: "var(--paper)",
            }}
          />
          <select
            name="category"
            defaultValue="servicios"
            style={{
              fontFamily: "var(--hand)",
              fontSize: 14,
              padding: "10px 12px",
              border: "1.5px solid var(--ink)",
              borderRadius: 8,
              background: "var(--paper)",
            }}
          >
            {Object.entries(CATEGORIAS).map(([k, c]) => (
              <option key={k} value={k}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
          <label
            className="t-hand"
            style={{
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--ink-3)",
            }}
          >
            <input type="checkbox" name="auto_approve" /> auto
          </label>
          <button type="submit" className="btn-sketch primary">
            + Agregar
          </button>
        </form>

        {!rules || rules.length === 0 ? (
          <div
            className="t-hand"
            style={{ color: "var(--ink-3)", padding: "8px 0", fontSize: 14 }}
          >
            Todavía no hay remitentes configurados. Agregá el primero arriba ↑
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rules.map((r) => {
              const cat = (r.category_id ?? "servicios") as CategoriaKey;
              const catInfo = CATEGORIAS[cat];
              return (
                <div
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.2fr auto auto auto auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 14px",
                    border: "1.5px solid var(--ink)",
                    borderRadius: 10,
                    background: "var(--paper-2)",
                  }}
                >
                  <div
                    className="t-mono"
                    style={{
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.sender_pattern}
                  </div>
                  <div className="t-hand" style={{ fontSize: 14, fontWeight: 700 }}>
                    {r.provider || "—"}
                  </div>
                  <span
                    className="chip"
                    style={{ background: catInfo.soft, fontSize: 12 }}
                  >
                    {catInfo.icon} {catInfo.label}
                  </span>
                  {r.auto_approve && <span className="chip green">auto</span>}
                  <span
                    className="t-hand"
                    style={{ fontSize: 12, color: "var(--ink-3)" }}
                  >
                    {r.hits} hits
                  </span>
                  <form action={removeRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="btn-sketch ghost"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      ✕
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="paper-plain"
        style={{
          padding: 22,
          border: "2px solid #1a1a1a",
          borderRadius: 14,
        }}
      >
        <div className="section-title">Cómo funciona</div>
        <div
          className="t-hand"
          style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.6 }}
        >
          Vercel Cron corre cada 15 minutos. Para cada remitente de la lista, busca
          mails nuevos desde el último scan y los manda a <strong>Claude Haiku</strong> que
          extrae proveedor, monto, vencimiento y categoría. Los gastos quedan en{" "}
          <span className="chip yellow">pendiente aprobar</span> (o auto-aprobados si tildaste
          "auto"). Tocando <em>Escanear ahora</em> disparás el scan de forma manual.
        </div>
      </div>
    </div>
  );
}
