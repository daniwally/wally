import { CATEGORIAS, type CategoriaKey } from "@/lib/mock-data";
import type { ExpenseRow } from "@/lib/data";
import { fmtMoney, diasHasta } from "@/lib/format";
import { payExpense, ignoreExpense, snoozeExpense } from "@/app/actions";

const ROTS = [-1.5, 1.2, -0.8, 1.8];
const BGS = ["var(--yellow)", "var(--pink-soft)", "var(--blue-soft)", "var(--green-soft)"];

export function StickyBill({ e, idx }: { e: ExpenseRow; idx: number }) {
  const cat = CATEGORIAS[(e.category_id ?? "servicios") as CategoriaKey];
  const rot = ROTS[idx % ROTS.length];
  const bg = BGS[idx % BGS.length];
  const dias = e.due_at ? diasHasta(e.due_at) : 999;

  return (
    <div
      style={{
        background: bg,
        padding: "16px 18px",
        transform: `rotate(${rot}deg)`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.12), 0 6px 18px rgba(0,0,0,0.1)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <div
            className="t-hand"
            style={{
              fontSize: 13,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {cat.icon} {cat.label}
          </div>
          <div className="t-title" style={{ fontSize: 26, lineHeight: 1, marginTop: 2 }}>
            {e.provider}
          </div>
          <div
            className="t-hand"
            style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 4 }}
          >
            {e.concept ?? ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="t-title" style={{ fontSize: 26, lineHeight: 1 }}>
            {fmtMoney(e.amount_cents / 100, e.currency)}
          </div>
          <div
            className="t-hand"
            style={{
              fontSize: 13,
              marginTop: 2,
              color: dias <= 3 ? "var(--red)" : "var(--ink-3)",
              fontWeight: dias <= 3 ? 700 : 400,
            }}
          >
            {e.due_at ? `vence en ${dias}d` : "sin vencimiento"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <form action={payExpense} style={{ flex: 1 }}>
          <input type="hidden" name="id" value={e.id} />
          <button type="submit" className="btn-sketch success" style={{ width: "100%" }}>
            ✓ pagar
          </button>
        </form>
        <form action={snoozeExpense} style={{ flex: 1 }}>
          <input type="hidden" name="id" value={e.id} />
          <input type="hidden" name="days" value="3" />
          <button type="submit" className="btn-sketch" style={{ width: "100%" }}>
            ⏰ 3d
          </button>
        </form>
        <form action={ignoreExpense}>
          <input type="hidden" name="id" value={e.id} />
          <button type="submit" className="btn-sketch ghost">
            ignorar
          </button>
        </form>
      </div>
    </div>
  );
}
