// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { Sparkles } from 'lucide-react';
import type { DayPeriod } from '@/lib/dates';
import { GLYPHS, PERIOD_GLYPHS } from './glyphMap';

/* One line-icon set for levels, achievements and the greeting. Emoji stay for
   content the user picks. */

export function Glyph({
  name,
  size = 20,
  className,
  strokeWidth = 1.9,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = GLYPHS[name] ?? Sparkles;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}

export function PeriodGlyph({
  period,
  size = 26,
  className,
}: {
  period: DayPeriod;
  size?: number;
  className?: string;
}) {
  const Icon = PERIOD_GLYPHS[period];
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden />;
}
