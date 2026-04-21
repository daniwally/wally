import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/v2/SubmitButton";
import { createManualExpense } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function NuevoPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;

  return (
    <>
      <PageHeader
        section="General"
        title="Nuevo gasto"
        right={
          <span className="v2-badge outline">
            <Icon.sparkle /> Claude Haiku extrae
          </span>
        }
      />
      <div className="v2-content" style={{ maxWidth: 720 }}>
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
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        <form
          action={createManualExpense}
          encType="multipart/form-data"
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          <div className="v2-card">
            <div className="v2-card-title" style={{ marginBottom: 10 }}>
              Descripción en lenguaje natural
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>
              Ejemplos: <em>gasté 50 lucas en el super</em> ·{" "}
              <em>ayer pagué 120k de luz</em> ·{" "}
              <em>el 15 de marzo compré auriculares USD 80</em>
            </div>
            <textarea
              name="text"
              rows={4}
              placeholder="gasté 50 lucas en el super…"
              className="v2-input"
              style={{
                fontFamily: "var(--sans)",
                fontSize: 14,
                lineHeight: 1.5,
                resize: "vertical",
              }}
            />
          </div>

          <div className="v2-card">
            <div className="v2-card-title" style={{ marginBottom: 10 }}>
              …o subí un ticket / factura{" "}
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  fontWeight: 400,
                  marginLeft: 4,
                }}
              >
                opcional
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>
              Imagen o PDF. Max 4MB. Claude lee el comprobante y extrae proveedor, monto, fecha y
              categoría. Si además escribís arriba, se usa como caption/contexto.
            </div>
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              className="v2-input"
              style={{ padding: "6px 10px", fontSize: 13 }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <a href="/" className="v2-btn ghost">
              Cancelar
            </a>
            <SubmitButton loadingLabel="Analizando con Claude…">
              <Icon.sparkle /> Registrar gasto
            </SubmitButton>
          </div>
        </form>

        <div
          style={{
            marginTop: 20,
            padding: "14px 16px",
            background: "var(--surface-2)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--text-3)",
            lineHeight: 1.5,
          }}
        >
          💡 <strong>Tip:</strong> si decís <em>&ldquo;gasté&rdquo;</em>, <em>&ldquo;pagué&rdquo;</em> o{" "}
          <em>&ldquo;compré&rdquo;</em> (tiempo pasado) → entra como <strong>pagado</strong>. Si
          decís <em>&ldquo;tengo que pagar&rdquo;</em>, <em>&ldquo;vence&rdquo;</em> → entra como{" "}
          <strong>pendiente</strong> con fecha de vencimiento.
        </div>
      </div>
    </>
  );
}
