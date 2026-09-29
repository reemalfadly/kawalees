import { useState } from 'react';
import { formatDate, fromDayKey } from '@/lib/dates';
import { plural, WORDS } from '@/lib/format';
import type { WeekCount } from '@/lib/stats';
import { niceDomain } from './scale';
import { useWidth } from './useWidth';

/* Published per week. One series, one colour; the current week is called out by
   its label and value. A hairline marks the goal. Time runs left-to-right. */

const PAD = { top: 26, bottom: 28, side: 8 };

function barPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  // Rounded data-end (top), square at the baseline.
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

export function WeeklyBars({
  weeks,
  goal,
  height = 200,
}: {
  weeks: WeekCount[];
  goal: number;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(goal, ...weeks.map((w) => w.count), 1);
  const dom = niceDomain(0, max, 3);
  const innerH = height - PAD.top - PAD.bottom;
  const slot = (width - PAD.side * 2) / weeks.length;
  const bw = Math.min(24, slot * 0.55);
  const y = (v: number) => PAD.top + innerH - (v / dom.max) * innerH;
  const cx = (i: number) => PAD.side + slot * (i + 0.5);
  const current = weeks.length - 1;
  const peak = weeks.reduce((best, w, i) => (w.count > (weeks[best]?.count ?? 0) ? i : best), 0);

  return (
    <div ref={ref} dir="ltr" className="relative w-full min-w-0 select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="المنشور في كل أسبوع"
        className="block overflow-visible"
      >
        <line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth={1} />
        <line x1={0} x2={width} y1={y(goal)} y2={y(goal)} stroke="var(--line-2)" strokeWidth={1} />
        <text x={width - 4} y={y(goal) - 6} className="fill-ink-3 text-[11px]" textAnchor="end">
          الهدف {goal}
        </text>
        {weeks.map((w, i) => {
          const h = y(0) - y(w.count);
          const isCur = i === current;
          return (
            <g key={w.weekStart}>
              <rect
                x={cx(i) - slot / 2}
                y={PAD.top - 10}
                width={slot}
                height={innerH + 10}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
              <path
                d={barPath(cx(i) - bw / 2, y(w.count), bw, h, 4)}
                fill="var(--accent)"
                className="pointer-events-none transition-opacity"
                opacity={hover == null || hover === i ? 1 : 0.55}
              />
              {w.count === 0 && (
                <rect
                  x={cx(i) - bw / 2}
                  y={y(0) - 2}
                  width={bw}
                  height={2}
                  rx={1}
                  fill="var(--line-2)"
                />
              )}
              {(isCur || hover === i || (i === peak && w.count > 0)) && (
                <text
                  x={cx(i)}
                  y={y(w.count) - 7}
                  textAnchor="middle"
                  className="fill-ink text-[12px] font-semibold tabular-nums"
                >
                  {w.count}
                </text>
              )}
              {(i % 2 === current % 2 || isCur) && (
                <text
                  x={cx(i)}
                  y={height - 8}
                  textAnchor="middle"
                  className={isCur ? 'fill-ink text-[11px] font-medium' : 'fill-ink-3 text-[11px]'}
                >
                  {isCur ? 'هالأسبوع' : formatDate.dayMonthShort(fromDayKey(w.weekStart))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && weeks[hover] && (
        <div
          dir="rtl"
          className="glass-strong pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl px-3 py-2 text-center whitespace-nowrap"
          style={{ left: Math.min(Math.max(cx(hover), 70), width - 70), top: 0 }}
        >
          <p className="text-[11px] text-ink-3">
            أسبوع {formatDate.dayMonth(fromDayKey(weeks[hover].weekStart))}
          </p>
          <p className="text-sm font-semibold text-ink">{plural(weeks[hover].count, WORDS.post)}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>المنشور في كل أسبوع، والهدف {goal}</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart}>
              <td>{formatDate.dayMonth(fromDayKey(w.weekStart))}</td>
              <td>{w.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
