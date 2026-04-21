"use client";

import { useState, useTransition } from "react";
import { rebuildStatementItemsClassification } from "@/app/actions";

export function RebuildButton({
  variant = "primary",
  label = "🔄 Rebuild con IA",
}: {
  variant?: "primary" | "default";
  label?: string;
}) {
  const [isRebuilding, startRebuild] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const handleClick = () => {
    startRebuild(async () => {
      const r = await rebuildStatementItemsClassification();
      if (r.error) setResult(`❌ ${r.error}`);
      else setResult(`✅ ${r.updated} de ${r.total} merchants reclasificados`);
      setTimeout(() => setResult(null), 6000);
    });
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isRebuilding}
        className={`v2-btn sm ${variant === "primary" ? "primary" : ""}`}
        style={{ opacity: isRebuilding ? 0.6 : 1 }}
        title="Re-aplicar tus reglas manuales (overrides + custom types) a TODOS los items ya cargados"
      >
        {isRebuilding ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                border: "2px solid currentColor",
                borderTopColor: "transparent",
                animation: "v2-spin 0.7s linear infinite",
                marginRight: 6,
              }}
            />
            Reclasificando…
          </>
        ) : (
          label
        )}
      </button>
      {result && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-2)",
            padding: "4px 8px",
            background: "var(--surface-2)",
            borderRadius: 6,
            whiteSpace: "nowrap",
          }}
        >
          {result}
        </div>
      )}
    </div>
  );
}
