export function Toggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 30,
        height: 18,
        borderRadius: 10,
        background: on ? "var(--text)" : "var(--surface-3)",
        position: "relative",
        transition: "background 0.15s",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          ...(on ? { right: 2 } : { left: 2 }),
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
        }}
      />
    </div>
  );
}
