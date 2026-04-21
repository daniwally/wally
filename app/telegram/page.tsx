import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { supabase, WALLY_USER_ID } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function TelegramPage() {
  const { data: user } = await supabase()
    .from("users")
    .select("telegram_chat_id")
    .eq("id", WALLY_USER_ID)
    .single();

  const connected = !!user?.telegram_chat_id;

  return (
    <>
      <PageHeader section="General" title="Telegram" />
      <div className="v2-content">
        <div className="v2-grid v2-grid-2" style={{ alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="v2-card">
              <div className="v2-card-header">
                <div>
                  <div className="v2-card-title">Bot</div>
                  <div
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 26,
                      marginTop: 4,
                      lineHeight: 1.1,
                    }}
                  >
                    @wally_gastos_bot
                  </div>
                </div>
                <span className={`v2-badge ${connected ? "green" : "red"}`}>
                  <span className="dot" />
                  {connected ? "conectado" : "sin conectar"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
                Te llegan notificaciones por cada gasto detectado con botones{" "}
                <strong>Pagar / Posponer / Ignorar</strong>. También podés mandarle gastos
                manuales (texto, foto de ticket o PDF) y Claude los registra.
              </div>
              {!connected && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 14px",
                    background: "var(--amber-soft)",
                    border: "1px solid var(--amber)",
                    borderRadius: 10,
                    fontSize: 13,
                    color: "var(--amber)",
                  }}
                >
                  Mandá <code>/start</code> al bot desde Telegram para conectarlo.
                </div>
              )}
              <a
                href="https://t.me/wally_gastos_bot"
                target="_blank"
                rel="noreferrer"
                className="v2-btn primary"
                style={{ marginTop: 14 }}
              >
                <Icon.send /> Abrir chat
              </a>
            </div>

            <div className="v2-card">
              <div className="v2-card-title">Comandos</div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <Command cmd="/status" desc="Lista los gastos pendientes de aprobar" />
                <Command cmd="/help" desc="Ayuda y ejemplos de uso" />
                <Command cmd="/start" desc="Reconectar el chat con tu cuenta" />
              </div>
            </div>

            <div className="v2-card">
              <div className="v2-card-title">Gastos manuales</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
                Podés mandarle al bot:
              </div>
              <ul
                style={{
                  marginTop: 8,
                  paddingLeft: 16,
                  fontSize: 13,
                  color: "var(--text-2)",
                  lineHeight: 1.7,
                }}
              >
                <li>
                  <strong>Texto libre:</strong> <em>&ldquo;gasté 50 lucas en el super&rdquo;</em>,
                  <em> &ldquo;tengo que pagar 120k de luz el 25&rdquo;</em>
                </li>
                <li>
                  <strong>Foto</strong> del ticket, factura impresa, código de pago
                </li>
                <li>
                  <strong>PDF</strong> de facturas o resúmenes
                </li>
              </ul>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--text-3)",
                }}
              >
                Claude Haiku procesa todo con vision + document API. Max 8MB.
              </div>
            </div>

            <div className="v2-card">
              <div className="v2-card-title">Digest diario</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
                Todos los días a las 9:00 (hora Argentina) te llega un resumen con lo gastado del
                mes, pendientes, próximos vencimientos y delta vs mes anterior.
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{ display: "flex", justifyContent: "center", position: "sticky", top: 100 }}>
            <TelegramPreview />
          </div>
        </div>
      </div>
    </>
  );
}

function Command({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
      <code
        style={{
          fontFamily: "var(--mono)",
          fontSize: 12,
          padding: "2px 8px",
          background: "var(--surface-2)",
          borderRadius: 6,
          color: "var(--text)",
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {cmd}
      </code>
      <span style={{ color: "var(--text-2)" }}>{desc}</span>
    </div>
  );
}

function TelegramPreview() {
  return (
    <div
      style={{
        width: 320,
        height: 640,
        background: "#fff",
        borderRadius: 38,
        border: "10px solid #141413",
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          height: 40,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 22px",
          fontSize: 13,
          fontWeight: 600,
          color: "#111",
        }}
      >
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <div
        style={{
          height: 54,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px",
          borderBottom: "1px solid #eee",
        }}
      >
        <span style={{ color: "#2563eb", fontSize: 18 }}>←</span>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "#141413",
            color: "#fafaf7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          W
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Wally</div>
          <div style={{ fontSize: 11, color: "#16a34a" }}>● en línea</div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          background: "#f5f5f0",
          padding: 12,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            alignSelf: "center",
            fontSize: 10.5,
            color: "#8a8a83",
            padding: "3px 10px",
            background: "#ececE4",
            borderRadius: 10,
          }}
        >
          hoy 14:32
        </div>
        <div
          style={{
            alignSelf: "flex-start",
            maxWidth: "82%",
            background: "#fff",
            border: "1px solid #e6e6df",
            padding: "8px 12px",
            borderRadius: "12px 12px 12px 4px",
            fontSize: 12.5,
            lineHeight: 1.4,
            color: "#141413",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, color: "#c2410c" }}>
            💳 nuevo gasto
          </div>
          <div style={{ fontWeight: 500 }}>Banco Galicia</div>
          <div style={{ color: "#52524d", fontSize: 12, marginTop: 2 }}>
            Resumen Visa · vence 28/04
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 500,
              marginTop: 6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            $412.350
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 8,
            }}
          >
            <button
              style={{
                flex: 1,
                background: "#141413",
                color: "#fafaf7",
                border: "none",
                padding: "6px 8px",
                borderRadius: 6,
                fontFamily: "Geist",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              ✓ Pagar
            </button>
            <button
              style={{
                flex: 1,
                background: "#f4f4ef",
                border: "1px solid #e6e6df",
                padding: "6px 8px",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              Posponer
            </button>
            <button
              style={{
                background: "transparent",
                border: "1px solid #e6e6df",
                padding: "6px 8px",
                borderRadius: 6,
                fontSize: 12,
                color: "#8a8a83",
              }}
            >
              ✕
            </button>
          </div>
        </div>
        <div
          style={{
            alignSelf: "flex-end",
            maxWidth: "82%",
            background: "#141413",
            color: "#fafaf7",
            padding: "8px 12px",
            borderRadius: "12px 12px 4px 12px",
            fontSize: 12.5,
          }}
        >
          gasté 50 lucas en el super
        </div>
        <div
          style={{
            alignSelf: "flex-start",
            maxWidth: "82%",
            background: "#fff",
            border: "1px solid #e6e6df",
            padding: "8px 12px",
            borderRadius: "12px 12px 12px 4px",
            fontSize: 12.5,
          }}
        >
          <div style={{ fontWeight: 500 }}>✅ Gasto registrado</div>
          <div style={{ marginTop: 4, color: "#52524d" }}>📦 Supermercado</div>
          <div style={{ fontWeight: 500, marginTop: 2 }}>$50.000 ARS</div>
        </div>
      </div>
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 14px",
          borderTop: "1px solid #eee",
        }}
      >
        <div
          style={{
            flex: 1,
            height: 30,
            background: "#f0f0eb",
            borderRadius: 16,
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            fontSize: 12,
            color: "#999",
          }}
        >
          Mensaje
        </div>
      </div>
    </div>
  );
}
