export function wobblyLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  amp = 1.5,
  seed = 0,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const steps = Math.max(4, Math.floor(len / 12));
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = x1 + dx * t;
    const ny = y1 + dy * t;
    const jitter = Math.sin(i * 1.7 + seed) * amp;
    const perpX = (-dy / len) * jitter;
    const perpY = (dx / len) * jitter;
    d += ` L ${(nx + perpX).toFixed(1)} ${(ny + perpY).toFixed(1)}`;
  }
  return d;
}
