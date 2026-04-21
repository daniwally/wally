import { Icon } from "./Icon";
import { USD_RATE } from "@/lib/mock-data";

export function PageHeader({
  section,
  title,
  right,
}: {
  section: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="v2-header">
      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 500,
          }}
        >
          {section}
        </div>
        <h1>{title}</h1>
      </div>
      <div className="v2-header-meta">
        {right ?? (
          <>
            <span className="v2-badge outline">
              <span className="dot" style={{ background: "var(--accent)" }} />
              Abril 2026
            </span>
            <span className="v2-badge">USD blue · ${USD_RATE}</span>
            <div style={{ width: 1, height: 22, background: "var(--border)" }} />
            <button className="v2-btn ghost" type="button">
              <Icon.search />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
