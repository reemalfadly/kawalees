// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { useId, useMemo, useState } from 'react';
import { diffDays, formatDate, fromDayKey } from '@/lib/dates';
import { formatCompact, formatNumber } from '@/lib/format';
import type { SeriesPoint } from '@/lib/stats';
import { monotonePath, niceDomain } from './scale';
import { useWidth } from './useWidth';

/* Single-series line over time. Time runs left-to-right (the convention readers
   of any script expect from a growth chart), newest value labelled at the end.
   2px line, 10% wash, hairline grid, crosshair tooltip, screen-reader table. */

const PAD = { top: 20, bottom: 30, start: 52, end: 18 };

export function LineChart({
  points,
  height = 240,
  label,
}: {
  points: SeriesPoint[];
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = `lc${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((p) => p.value);
    const dom = niceDomain(Math.min(...values), Math.max(...values), 4);
    const first = points[0]!.date;
    const span = Math.max(1, diffDays(points[points.length - 1]!.date, first));
    const innerW = Math.max(10, width - PAD.start - PAD.end);
    const innerH = height - PAD.top - PAD.bottom;
    const x = (date: string) => PAD.start + (diffDays(date, first) / span) * innerW;
    const y = (v: number) => PAD.top + innerH - ((v - dom.min) / (dom.max - dom.min)) * innerH;
    const pts = points.map((p) => ({
      x: points.length === 1 ? width / 2 : x(p.date),
      y: y(p.value),
    }));
    return { dom, pts, y, innerH };
  }, [points, width, height]);

  if (!geo) return null;
  const { dom, pts, y } = geo;
  const path = monotonePath(pts);
  const last = pts[pts.length - 1]!;
  const baseline = height - PAD.bottom;
  const area = `${path} L${last.x},${baseline} L${pts[0]!.x},${baseline} Z`;
  const tickIdx =
    points.length <= 4
      ? points.map((_, i) => i)
      : [0, Math.round((points.length - 1) / 2), points.length - 1];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let dist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover != null ? pts[hover] : null;
  const hv = hover != null ? points[hover] : null;

  return (
    <div
      ref={ref}
      dir="ltr"
      className="relative w-full min-w-0 overflow-hidden select-none"
      style={{ height }}
    >
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="block touch-pan-y overflow-visible"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {dom.ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.start - 6}
              x2={width - PAD.end}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={PAD.start - 12}
              y={y(t)}
              dy="0.35em"
              textAnchor="end"
              className="fill-ink-3 text-[11px] tabular-nums"
            >
              {formatCompact(t)}
            </text>
          </g>
        ))}
        {tickIdx.map((i) => (
          <text
            key={i}
            x={pts[i]!.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-ink-3 text-[11px]"
          >
            {formatDate.dayMonthShort(fromDayKey(points[i]!.date))}
          </text>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hp && (
          <line
            x1={hp.x}
            x2={hp.x}
            y1={PAD.top - 6}
            y2={baseline}
            stroke="var(--line-2)"
            strokeWidth={1}
          />
        )}
        <circle
          cx={last.x}
          cy={last.y}
          r={5}
          fill="var(--accent)"
          stroke="var(--solid)"
          strokeWidth={2.5}
        />
        {hover == null && (
          <text
            x={last.x}
            y={last.y - 14}
            textAnchor="end"
            className="fill-ink text-[12px] font-semibold tabular-nums"
          >
            {formatCompact(points[points.length - 1]!.value)}
          </text>
        )}
        {hp && hover !== pts.length - 1 && (
          <circle
            cx={hp.x}
            cy={hp.y}
            r={5}
            fill="var(--accent)"
            stroke="var(--solid)"
            strokeWidth={2.5}
          />
        )}
      </svg>
      {hp && hv && (
        <div
          dir="rtl"
          className="glass-strong pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl px-3 py-2 text-center"
          style={{ left: Math.min(Math.max(hp.x, 60), width - 60), top: Math.max(0, hp.y - 64) }}
        >
          <p className="text-[11px] text-ink-3">{formatDate.dayMonth(fromDayKey(hv.date))}</p>
          <p className="font-display text-sm font-bold text-ink">
            <span className="num">{formatNumber(hv.value)}</span>
          </p>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>القيمة</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{formatDate.dayMonth(fromDayKey(p.date))}</td>
              <td>{formatNumber(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
