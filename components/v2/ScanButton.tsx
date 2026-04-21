"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "../Icon";

export function ScanButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="v2-btn sm ghost"
      title={pending ? "Escaneando inbox…" : "Escanear inbox ahora"}
      disabled={pending}
      style={{ padding: "4px 6px", opacity: pending ? 0.7 : 1 }}
    >
      <span
        style={{
          display: "inline-flex",
          animation: pending ? "v2-spin 0.9s linear infinite" : undefined,
        }}
      >
        <Icon.refresh />
      </span>
    </button>
  );
}
