import { supabase, WALLY_USER_ID } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const { ok, error } = await searchParams;

  const { data: accounts } = await supabase()
    .from("accounts")
    .select("id, type, account, status, last_scan_at, created_at")
    .eq("user_id", WALLY_USER_ID)
    .order("created_at", { ascending: false });

  const gmails = (accounts ?? []).filter((a) => a.type === "gmail");

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">
          Cuentas conectadas, reglas y configuración
        </p>
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
            No hay cuentas conectadas todavía. Clickeá <strong>Conectar Gmail</strong> para
            autorizar el acceso a tu bandeja.
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

      <div
        className="paper-plain"
        style={{
          padding: 22,
          border: "2px solid #1a1a1a",
          borderRadius: 14,
        }}
      >
        <div className="section-title">Cron del parser</div>
        <div className="t-hand" style={{ fontSize: 15, color: "var(--ink-2)" }}>
          Vercel Cron corre cada 15 minutos escaneando la inbox desde el último scan. Cada
          mail pasa por Claude Haiku para decidir si es un gasto y extraer los datos.
        </div>
      </div>
    </div>
  );
}
