import { CAT_COLOR, CAT_ICON } from "../Icon";
import { fmtMoney, fmtDateShort, diasHasta } from "@/lib/format";
import type { ExpenseRow } from "@/lib/data";

export function PendRow({ e, last }: { e: ExpenseRow; last?: boolean }) {
  const dias = e.due_at ? diasHasta(e.due_at) : 999;
  const urgent = dias <= 3;
  const cat = e.category_id ?? "servicios";
  const IconEl = CAT_ICON[cat] ?? CAT_ICON.servicios;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px",
        borderBottom: last ? "none" : "1px solid var(--border)",
      }}
    >
      <span
        className="v2-avatar"
        style={{ background: "var(--surface-2)", color: CAT_COLOR[cat] ?? "#737373" }}
      >
        <IconEl />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {e.provider}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {e.concept ? `${e.concept} · ` : ""}
          {e.due_at ? `vence ${fmtDateShort(e.due_at)}` : "sin vencimiento"}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtMoney(e.amount_cents / 100, e.currency)}
        </div>
        {e.due_at && (
          <div
            style={{
              fontSize: 11,
              color: urgent ? "var(--red)" : "var(--text-3)",
              fontWeight: urgent ? 500 : 400,
            }}
          >
            {dias}d
          </div>
        )}
      </div>
    </div>
  );
}
