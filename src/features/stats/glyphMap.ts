// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import {
  Cog,
  Crown,
  Flame,
  Globe,
  Lightbulb,
  Library,
  CalendarCheck,
  ChartLine,
  CloudSun,
  Moon,
  MoonStar,
  Orbit,
  PenLine,
  Rocket,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { DayPeriod } from '@/lib/dates';

/* The line icons behind levels, achievements and the greeting, keyed by the stable
   `icon` strings in lib/stats.ts. */

export const GLYPHS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  flame: Flame,
  star: Star,
  globe: Globe,
  rocket: Rocket,
  orbit: Orbit,
  'moon-star': MoonStar,
  crown: Crown,
  lightbulb: Lightbulb,
  library: Library,
  waves: Waves,
  cog: Cog,
  'pen-line': PenLine,
  zap: Zap,
  trophy: Trophy,
  'calendar-check': CalendarCheck,
  'chart-line': ChartLine,
};

/** Every icon key the Glyph component can draw. */
export const GLYPH_KEYS = Object.keys(GLYPHS);

export const PERIOD_GLYPHS: Record<DayPeriod, LucideIcon> = {
  morning: Sun,
  noon: CloudSun,
  evening: Moon,
  night: Sparkles,
};
