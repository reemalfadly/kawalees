// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { db } from './db';
import { DEFAULT_PILLARS } from './catalog';
import { todayKey } from './dates';
import type { Idea, Pillar, PlatformId, Settings, Stage, StatEntry } from './types';

/* All writes go through here. Each one also records "activity" for today,
   which is what drives streaks and the heatmap. */

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'me',
  name: '',
  avatar: '✨',
  platforms: ['instagram', 'tiktok', 'youtube'],
  weeklyGoal: 3,
  theme: 'system',
  accent: 'ember',
  weekStartsOn: 0,
  wordsPerMinute: 140,
  celebrations: true,
  haptics: true,
  onboarded: false,
  createdAt: 0,
};

async function bumpActivity(n = 1): Promise<void> {
  const day = todayKey();
  const current = await db.activity.get(day);
  await db.activity.put({ day, count: (current?.count ?? 0) + n });
}

// ── Settings ───────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const saved = await db.settings.get('me');
  // Spread over defaults so records saved by older versions pick up new fields.
  return saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS, createdAt: Date.now() };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'me' });
}

export async function completeOnboarding(input: {
  name: string;
  avatar: string;
  platforms: PlatformId[];
  weeklyGoal: number;
}): Promise<void> {
  await db.transaction('rw', db.settings, db.pillars, async () => {
    const current = await getSettings();
    await db.settings.put({
      ...current,
      ...input,
      onboarded: true,
      createdAt: current.createdAt || Date.now(),
    });
    if ((await db.pillars.count()) === 0) {
      await db.pillars.bulkPut(DEFAULT_PILLARS.map((p, order) => ({ id: newId(), ...p, order })));
    }
  });
}

// ── Ideas ──────────────────────────────────────────────────────

export type IdeaDraft = Partial<Omit<Idea, 'id' | 'createdAt' | 'updatedAt'>> & { title: string };

export function buildIdea(draft: IdeaDraft, now = Date.now()): Idea {
  const stage = draft.stage ?? 'idea';
  return {
    id: newId(),
    title: draft.title.trim(),
    notes: draft.notes ?? '',
    stage,
    platforms: draft.platforms ?? [],
    format: draft.format ?? 'reel',
    pillarId: draft.pillarId ?? null,
    spark: draft.spark ?? 2,
    hook: draft.hook ?? '',
    body: draft.body ?? '',
    cta: draft.cta ?? '',
    scheduledFor: draft.scheduledFor ?? null,
    scheduledTime: draft.scheduledTime ?? null,
    publishedAt: draft.publishedAt ?? (stage === 'published' ? now : null),
    archived: draft.archived ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createIdea(draft: IdeaDraft): Promise<Idea> {
  const idea = buildIdea(draft);
  await db.ideas.add(idea);
  await bumpActivity();
  return idea;
}

export async function updateIdea(
  id: string,
  patch: Partial<Omit<Idea, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.ideas.update(id, { ...patch, updatedAt: Date.now() });
}

/** Content edits (typing) count as activity at most once per idea per save burst. */
export async function touchActivity(): Promise<void> {
  await bumpActivity();
}

export async function setStage(id: string, stage: Stage): Promise<Idea | undefined> {
  const idea = await db.ideas.get(id);
  if (!idea || idea.stage === stage) return idea;
  const patch: Partial<Idea> = { stage, updatedAt: Date.now() };
  if (stage === 'published' && idea.publishedAt == null) patch.publishedAt = Date.now();
  if (stage !== 'published') patch.publishedAt = null;
  await db.ideas.update(id, patch);
  await bumpActivity();
  return { ...idea, ...patch };
}

export async function scheduleIdea(
  id: string,
  day: string | null,
  time: string | null = null,
): Promise<void> {
  await db.ideas.update(id, {
    scheduledFor: day,
    scheduledTime: day ? time : null,
    updatedAt: Date.now(),
  });
  await bumpActivity();
}

export async function duplicateIdea(id: string): Promise<Idea | undefined> {
  const src = await db.ideas.get(id);
  if (!src) return undefined;
  const copy = buildIdea({
    ...src,
    title: `${src.title} (نسخة)`,
    stage: src.stage === 'published' ? 'ready' : src.stage,
    publishedAt: null,
    scheduledFor: null,
    scheduledTime: null,
  });
  await db.ideas.add(copy);
  await bumpActivity();
  return copy;
}

/** Deletes and hands back the record so the caller can offer "undo". */
export async function deleteIdea(id: string): Promise<Idea | undefined> {
  const idea = await db.ideas.get(id);
  if (idea) await db.ideas.delete(id);
  return idea;
}

export async function restoreIdea(idea: Idea): Promise<void> {
  await db.ideas.put(idea);
}

// ── Pillars ────────────────────────────────────────────────────

export async function savePillar(
  pillar: Omit<Pillar, 'id' | 'order'> & { id?: string },
): Promise<void> {
  if (pillar.id) {
    await db.pillars.update(pillar.id, { name: pillar.name, emoji: pillar.emoji });
    return;
  }
  const order = (await db.pillars.count()) + 1;
  await db.pillars.add({ id: newId(), name: pillar.name, emoji: pillar.emoji, order });
}

export async function deletePillar(id: string): Promise<void> {
  await db.transaction('rw', db.pillars, db.ideas, async () => {
    await db.pillars.delete(id);
    await db.ideas.where('pillarId').equals(id).modify({ pillarId: null });
  });
}

// ── Audience stats ─────────────────────────────────────────────

export async function addStat(input: Omit<StatEntry, 'id' | 'createdAt'>): Promise<void> {
  await db.stats.add({ ...input, id: newId(), createdAt: Date.now() });
  await bumpActivity();
}

export async function deleteStat(id: string): Promise<StatEntry | undefined> {
  const s = await db.stats.get(id);
  if (s) await db.stats.delete(id);
  return s;
}

export async function restoreStat(s: StatEntry): Promise<void> {
  await db.stats.put(s);
}
