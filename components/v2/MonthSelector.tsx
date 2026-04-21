"use client";

import { useRouter } from "next/navigation";
import { Icon } from "../Icon";

export function MonthSelector({
  current,
  options,
}: {
  current: string;
  options: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();

  const currentIdx = options.findIndex((o) => o.value === current);
  const prev = currentIdx < options.length - 1 ? options[currentIdx + 1] : null;
  const next = currentIdx > 0 ? options[currentIdx - 1] : null;

  const go = (mes: string) => router.push(`/?mes=${mes}`);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        background: "var(--surface-2)",
        borderRadius: 8,
        padding: 2,
      }}
    >
      <button
        type="button"
        className="v2-btn ghost sm"
        onClick={() => prev && go(prev.value)}
        disabled={!prev}
        style={{ padding: "3px 6px", opacity: prev ? 1 : 0.3 }}
        title={prev ? `Ir a ${prev.label}` : "No hay mes anterior"}
      >
        ‹
      </button>
      <select
        value={current}
        onChange={(e) => go(e.target.value)}
        style={{
          border: "none",
          background: "transparent",
          padding: "4px 8px",
          fontSize: 12,
          fontFamily: "var(--sans)",
          fontWeight: 500,
          cursor: "pointer",
          outline: "none",
          color: "var(--text)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="v2-btn ghost sm"
        onClick={() => next && go(next.value)}
        disabled={!next}
        style={{ padding: "3px 6px", opacity: next ? 1 : 0.3 }}
        title={next ? `Ir a ${next.label}` : "No hay mes posterior"}
      >
        ›
      </button>
      {current !== options[0]?.value && (
        <button
          type="button"
          className="v2-btn ghost sm"
          onClick={() => go(options[0].value)}
          style={{ padding: "3px 6px" }}
          title="Volver al mes actual"
        >
          <Icon.refresh />
        </button>
      )}
    </div>
  );
}
