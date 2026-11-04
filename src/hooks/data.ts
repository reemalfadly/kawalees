// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/lib/repo';
import type { ActivityDay, Idea, Pillar, Settings, StatEntry } from '@/lib/types';

/* Live views of the database. Components re-render by themselves whenever
   the underlying rows change, from any tab or window. */

const EMPTY_IDEAS: Idea[] = [];
const EMPTY_PILLARS: Pillar[] = [];
const EMPTY_STATS: StatEntry[] = [];
const EMPTY_ACTIVITY: ActivityDay[] = [];

/** undefined while loading, null when the app has never been set up. */
export function useSettingsRecord(): Settings | null | undefined {
  return useLiveQuery(async () => {
    const saved = await db.settings.get('me');
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : null;
  });
}

/** Settings with defaults filled in, for screens that render after onboarding. */
export function useSettings(): Settings {
  const s = useSettingsRecord();
  return s ?? DEFAULT_SETTINGS;
}

export function useIdeas(): Idea[] {
  return useLiveQuery(() => db.ideas.toArray(), [], EMPTY_IDEAS);
}

export function useLiveIdeas(): Idea[] {
  const all = useIdeas();
  return useMemo(() => all.filter((i) => !i.archived), [all]);
}

export function useIdea(id: string | undefined): Idea | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.ideas.get(id)) ?? null) : null), [id]);
}

export function usePillars(): Pillar[] {
  return useLiveQuery(() => db.pillars.orderBy('order').toArray(), [], EMPTY_PILLARS);
}

export function useStats(): StatEntry[] {
  return useLiveQuery(() => db.stats.toArray(), [], EMPTY_STATS);
}

export function useActivity(): ActivityDay[] {
  return useLiveQuery(() => db.activity.toArray(), [], EMPTY_ACTIVITY);
}

export function useActivityMap(): Map<string, number> {
  const rows = useActivity();
  return useMemo(() => new Map(rows.map((r) => [r.day, r.count])), [rows]);
}
