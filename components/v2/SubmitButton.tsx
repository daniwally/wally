"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  loadingLabel = "Procesando…",
  className = "v2-btn primary",
  style,
}: {
  children: ReactNode;
  loadingLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      style={{ opacity: pending ? 0.7 : 1, ...style }}
    >
      {pending ? (
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
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
