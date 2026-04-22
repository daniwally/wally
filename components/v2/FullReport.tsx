"use client";

import { useState, useTransition } from "react";
import { generateFullReport } from "@/app/actions";
import { Icon } from "../Icon";

export function FullReport() {
  const [report, setReport] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ items: number; batches: number } | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateFullReport();
      if (result.error) {
        setError(result.error);
        return;
      }
      setReport(result.report);
      setMeta({ items: result.totalItems, batches: result.totalBatches });
      setGeneratedAt(new Date());
    });
  };

  return (
    <div className="v2-card" style={{ marginTop: 16, padding: 0 }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: report ? "1px solid var(--border)" : "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div className="v2-card-title">✨ Informe ejecutivo con IA</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
            Claude Sonnet 4.6 analiza TODOS tus consumos y genera un reporte estilo
            Mint/YNAB con oportunidades de reducción específicas
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {generatedAt && (
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              generado: {generatedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="v2-btn primary"
            style={{ opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    animation: "v2-spin 0.7s linear infinite",
                    marginRight: 6,
                  }}
                />
                Analizando con IA…
              </>
            ) : report ? (
              <>🔄 Regenerar informe</>
            ) : (
              <>
                <Icon.sparkle /> Generar informe completo
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "14px 20px",
            color: "var(--red)",
            background: "var(--red-soft)",
            fontSize: 13,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {report && (
        <div style={{ padding: "20px 24px" }}>
          {meta && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-3)",
                marginBottom: 16,
                padding: "6px 10px",
                background: "var(--surface-2)",
                borderRadius: 6,
                display: "inline-block",
              }}
            >
              📄 Basado en {meta.items} consumos de {meta.batches} resúmenes
            </div>
          )}
          <div className="v2-report-content">
            <MarkdownRenderer text={report} />
          </div>
        </div>
      )}
    </div>
  );
}

// Renderer markdown-lite (headers, bullets, bold, code)
function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul
        key={`list-${elements.length}`}
        style={{ marginTop: 8, marginBottom: 14, paddingLeft: 22, fontSize: 14, lineHeight: 1.65 }}
      >
        {listBuffer.map((l, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <span dangerouslySetInnerHTML={{ __html: renderInline(l) }} />
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h3
          key={`h-${idx}`}
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginTop: elements.length === 0 ? 0 : 24,
            marginBottom: 10,
            color: "var(--text)",
            fontFamily: "var(--serif)",
          }}
        >
          {trimmed.replace(/^##\s*/, "")}
        </h3>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listBuffer.push(trimmed.replace(/^[-*]\s*/, ""));
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p
          key={`p-${idx}`}
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            marginBottom: 10,
            color: "var(--text-2)",
          }}
          dangerouslySetInnerHTML={{ __html: renderInline(trimmed) }}
        />,
      );
    }
  });
  flushList();

  return <>{elements}</>;
}

function renderInline(text: string): string {
  // Escape HTML
  let out = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  out = out.replace(/(^|\s)\*([^*]+)\*/g, "$1<em>$2</em>");
  // Code
  out = out.replace(/`([^`]+)`/g, '<code style="font-family: var(--mono); font-size: 12px; background: var(--surface-2); padding: 1px 5px; border-radius: 4px;">$1</code>');
  return out;
}
