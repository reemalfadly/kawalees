/* Tiny scale helpers so charts don't need a charting library. */

export function niceStep(range: number, targetTicks = 4): number {
  if (range <= 0) return 1;
  const raw = range / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1;
  return step * mag;
}

/** A padded, rounded y-domain and its tick values. */
export function niceDomain(
  min: number,
  max: number,
  targetTicks = 4,
): { min: number; max: number; ticks: number[] } {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min, targetTicks);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: lo, max: hi, ticks };
}

/** Monotone cubic path through points (no overshoot between samples). */
export function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0]!.x},${pts[0]!.y}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    dx.push(b.x - a.x);
    slope.push(b.x - a.x === 0 ? 0 : (b.y - a.y) / (b.x - a.x));
  }
  const m: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope[i - 1]!;
    const s1 = slope[i]!;
    m.push(
      s0 * s1 <= 0
        ? 0
        : (3 * (dx[i - 1]! + dx[i]!)) /
            ((2 * dx[i]! + dx[i - 1]!) / s0 + (dx[i]! + 2 * dx[i - 1]!) / s1),
    );
  }
  m.push(slope[n - 2]!);
  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${a.x + h},${a.y + m[i]! * h} ${b.x - h},${b.y - m[i + 1]! * h} ${b.x},${b.y}`;
  }
  return d;
}
