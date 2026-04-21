"use client";

import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { fmtARS } from "@/lib/format";
import {
  deleteStatementBatch,
  deleteMultipleBatches,
  analyzeBatchesAI,
} from "@/app/actions";

export type Batch = {
  batchId: string;
  provider: string;
  period: string | null;
  itemCount: number;
  totalArs: number;
};

export function BatchSelector({ batches }: { batches: Batch[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [analysisText, setAnalysisText] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === batches.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(batches.map((b) => b.batchId)));
    }
  };

  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Borrar ${selected.size} resúmenes del análisis?`)) return;
    startTransition(async () => {
      const fd = new FormData();
      Array.from(selected).forEach((id) => fd.append("batch_ids", id));
      await deleteMultipleBatches(fd);
      setSelected(new Set());
    });
  };

  const handleAnalyze = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      const fd = new FormData();
      Array.from(selected).forEach((id) => fd.append("batch_ids", id));
      const result = await analyzeBatchesAI(fd);
      setAnalysisText(result);
    });
  };

  const selectedTotal = batches
    .filter((b) => selected.has(b.batchId))
    .reduce((s, b) => s + b.totalArs, 0);
  const selectedItems = batches
    .filter((b) => selected.has(b.batchId))
    .reduce((s, b) => s + b.itemCount, 0);

  return (
    <>
      {/* Selection bar */}
      {selected.size > 0 && (
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--accent-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 13, color: "var(--accent-ink)" }}>
            <strong>{selected.size}</strong> seleccionados ·{" "}
            <strong>{selectedItems}</strong> consumos · <strong>{fmtARS(selectedTotal)}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="v2-btn sm primary"
              onClick={handleAnalyze}
              disabled={isPending}
            >
              <Icon.sparkle /> {isPending ? "Analizando…" : "Análisis IA"}
            </button>
            <button
              type="button"
              className="v2-btn sm"
              style={{ color: "var(--red)" }}
              onClick={handleDeleteSelected}
              disabled={isPending}
            >
              <Icon.trash /> Borrar seleccionados
            </button>
            <button
              type="button"
              className="v2-btn sm ghost"
              onClick={() => setSelected(new Set())}
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      <table className="v2-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                checked={selected.size === batches.length && batches.length > 0}
                onChange={toggleAll}
                title="Seleccionar todos"
              />
            </th>
            <th>Proveedor</th>
            <th>Período</th>
            <th style={{ textAlign: "right" }}>Items</th>
            <th style={{ textAlign: "right" }}>Total ARS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr
              key={b.batchId}
              style={{
                background: selected.has(b.batchId) ? "var(--accent-soft)" : undefined,
              }}
            >
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(b.batchId)}
                  onChange={() => toggle(b.batchId)}
                />
              </td>
              <td style={{ fontWeight: 500 }}>{b.provider}</td>
              <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{b.period ?? "—"}</td>
              <td
                style={{
                  textAlign: "right",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                }}
              >
                {b.itemCount}
              </td>
              <td
                style={{
                  textAlign: "right",
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtARS(b.totalArs)}
              </td>
              <td style={{ textAlign: "right" }}>
                <form
                  action={deleteStatementBatch}
                  onSubmit={() => {
                    if (!confirm(`¿Borrar este resumen (${b.provider})?`)) return;
                  }}
                >
                  <input type="hidden" name="batch_id" value={b.batchId} />
                  <button
                    type="submit"
                    className="v2-btn sm ghost"
                    style={{ color: "var(--red)" }}
                    title="Borrar este resumen"
                  >
                    <Icon.trash />
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* AI Analysis result */}
      {analysisText && (
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
              ✨ Análisis IA
            </div>
            <button
              type="button"
              className="v2-btn sm ghost"
              onClick={() => setAnalysisText(null)}
            >
              <Icon.x /> Cerrar
            </button>
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--text)",
              whiteSpace: "pre-wrap",
              fontFamily: "var(--sans)",
            }}
          >
            {analysisText}
          </div>
        </div>
      )}
    </>
  );
}
