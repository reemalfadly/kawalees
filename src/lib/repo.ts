// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { db } from './db';
import { DEFAULT_PILLARS } from './catalog';
import { todayKey } from './dates';
import {
  applyExtras,
  checkMove,
  checkSchedule,
  isForwardMove,
  isRealDayKey,
  isRealTimeKey,
  proofProblem,
  reachableStage,
  urlProblem,
  type GateResult,
  type MoveExtras,
  type Requirement,
} from './gates';
import {
  STAGES,
  type Idea,
  type Pillar,
  type PlatformId,
  type Settings,
  type Stage,
  type StatEntry,
} from './types';

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

/** Pure builder, no gates: used by the demo data and tests. Anything that reaches the
    database for real goes through `createIdea`, which applies the gates. */
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
    ...(draft.approvals ? { approvals: draft.approvals } : {}),
    ...(draft.proof !== undefined ? { proof: draft.proof } : {}),
    ...(draft.publishedUrl !== undefined ? { publishedUrl: draft.publishedUrl } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

/** A new idea starts a gated life: no approvals yet. A stage or a day asked for up front is
    kept only as far as the gates allow (an empty idea lands in «فكرة» and stays unscheduled). */
function buildGated(draft: IdeaDraft, wantedStage: Stage, now = Date.now()): Idea {
  const base = buildIdea(
    {
      ...draft,
      stage: 'idea',
      publishedAt: null,
      scheduledFor: null,
      scheduledTime: null,
      approvals: {},
      proof: undefined,
      publishedUrl: undefined,
    },
    now,
  );
  const stage = reachableStage(base, wantedStage);
  const schedule = Boolean(draft.scheduledFor) && checkSchedule(base).ok;
  return {
    ...base,
    stage,
    scheduledFor: schedule ? (draft.scheduledFor ?? null) : null,
    scheduledTime: schedule ? (draft.scheduledTime ?? null) : null,
  };
}

export async function createIdea(draft: IdeaDraft): Promise<Idea> {
  const idea = buildGated(draft, draft.stage ?? 'idea');
  await db.ideas.add(idea);
  await bumpActivity();
  return idea;
}

/** Fields that only the gated functions below may change; `updateIdea` ignores them. */
export const GATED_FIELDS = [
  'stage',
  'publishedAt',
  'scheduledFor',
  'scheduledTime',
  'approvals',
  'proof',
  'publishedUrl',
] as const;

export type IdeaEdit = Partial<
  Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | (typeof GATED_FIELDS)[number]>
>;

/** Content edits only (title, text, platforms…). Stage, schedule, approvals and proof are
    refused here on purpose: use `moveIdeaStage`, `scheduleIdea` and `updateProof`. */
export async function updateIdea(id: string, patch: IdeaEdit): Promise<void> {
  const safe: Record<string, unknown> = { ...patch };
  for (const key of [...GATED_FIELDS, 'id', 'createdAt', 'updatedAt']) delete safe[key];
  await db.ideas.update(id, { ...safe, updatedAt: Date.now() });
}

/** Content edits (typing) count as activity at most once per idea per save burst. */
export async function touchActivity(): Promise<void> {
  await bumpActivity();
}

export interface MoveResult extends GateResult {
  /** The idea after the call (unchanged when refused). */
  idea?: Idea;
  /** Set when the idea no longer exists. */
  error?: 'not-found';
}

/** The one door between stages. Backward is always free; forward needs every gate on the way
    (see ./gates), with the person's approvals, proof and link passed in `extras`.
    A refused move writes nothing: no stage, no activity, no streak. */
export async function moveIdeaStage(
  id: string,
  toStage: Stage,
  extras: MoveExtras = {},
  now = Date.now(),
): Promise<MoveResult> {
  return db.transaction('rw', db.ideas, db.activity, async (): Promise<MoveResult> => {
    const idea = await db.ideas.get(id);
    if (!idea) return { ok: false, missing: [], error: 'not-found' };
    // Anything that is not a real stage is refused: «backward is free» must never write a made-up stage.
    if (!STAGES.includes(toStage))
      return { ok: false, missing: [badInput('stage', 'مرحلة معروفة', 'stage')], idea };
    if (idea.stage === toStage) return { ok: true, missing: [], idea };

    if (!isForwardMove(idea.stage, toStage)) {
      const patch: Partial<Idea> = { stage: toStage, publishedAt: null, updatedAt: now };
      await db.ideas.update(id, patch);
      return { ok: true, missing: [], idea: { ...idea, ...patch } };
    }

    const gate = checkMove(idea, toStage, extras, now);
    if (!gate.ok) return { ...gate, idea };

    // Save exactly what the gate accepted: approvals for the stages crossed, proof and link.
    const accepted = applyExtras(idea, toStage, extras, now);
    const patch: Partial<Idea> = {
      approvals: accepted.approvals ?? {},
      stage: toStage,
      publishedAt: toStage === 'published' ? (idea.publishedAt ?? now) : null,
      updatedAt: now,
    };
    if (accepted.proof !== undefined) patch.proof = accepted.proof;
    if (accepted.publishedUrl !== undefined) patch.publishedUrl = accepted.publishedUrl;
    await db.ideas.update(id, patch);
    await bumpActivity();
    return { ok: true, missing: [], idea: { ...idea, ...patch } };
  });
}

function badInput(id: string, label: string, field: string): Requirement {
  return { id, label, met: false, kind: 'field', field, stage: 'script' };
}

/** Putting a day on an idea needs the script gate (`checkSchedule`). Clearing is always allowed,
    and so is changing only the time of the day it already has. */
export async function scheduleIdea(
  id: string,
  day: string | null,
  time: string | null = null,
): Promise<MoveResult> {
  return db.transaction('rw', db.ideas, db.activity, async (): Promise<MoveResult> => {
    const idea = await db.ideas.get(id);
    if (!idea) return { ok: false, missing: [], error: 'not-found' };

    if (day === null) {
      const patch = { scheduledFor: null, scheduledTime: null, updatedAt: Date.now() };
      await db.ideas.update(id, patch);
      return { ok: true, missing: [], idea: { ...idea, ...patch } };
    }

    const bad: Requirement[] = [];
    if (!isRealDayKey(day))
      bad.push(badInput('schedule-date', 'تاريخ صالح بصيغة YYYY-MM-DD', 'scheduledFor'));
    if (time !== null && !isRealTimeKey(time))
      bad.push(badInput('schedule-time', 'وقت صالح بصيغة HH:mm', 'scheduledTime'));
    if (bad.length) return { ok: false, missing: bad, idea };

    const changesDay = idea.scheduledFor !== day;
    if (changesDay) {
      const gate = checkSchedule(idea);
      if (!gate.ok) return { ...gate, idea };
    }
    const patch = { scheduledFor: day, scheduledTime: time, updatedAt: Date.now() };
    await db.ideas.update(id, patch);
    if (changesDay) await bumpActivity();
    return { ok: true, missing: [], idea: { ...idea, ...patch } };
  });
}

/** Correcting the proof or the post link afterwards. Empty clears; anything else must be valid. */
export async function updateProof(
  id: string,
  input: { proof?: string; publishedUrl?: string },
): Promise<MoveResult> {
  const idea = await db.ideas.get(id);
  if (!idea) return { ok: false, missing: [], error: 'not-found' };
  const patch: Partial<Idea> = {};
  const missing: Requirement[] = [];
  if (input.proof !== undefined) {
    const v = input.proof.trim();
    const problem = proofProblem(v);
    if (problem)
      missing.push({
        id: 'proof',
        label: problem,
        met: false,
        kind: 'proof',
        field: 'proof',
        stage: 'edit',
      });
    else patch.proof = v;
  }
  if (input.publishedUrl !== undefined) {
    const v = input.publishedUrl.trim();
    const problem = urlProblem(v);
    if (problem)
      missing.push({
        id: 'published-url',
        label: problem,
        met: false,
        kind: 'url',
        field: 'publishedUrl',
        stage: 'ready',
      });
    else patch.publishedUrl = v;
  }
  if (missing.length) return { ok: false, missing, idea };
  await db.ideas.update(id, { ...patch, updatedAt: Date.now() });
  return { ok: true, missing: [], idea: { ...idea, ...patch } };
}

const COPY_SUFFIX = ' (نسخة)';

/** The title keeps within the 300 characters a backup accepts, however many times it is copied. */
function copyTitle(title: string): string {
  return title.length + COPY_SUFFIX.length <= 300
    ? `${title}${COPY_SUFFIX}`
    : `${title.slice(0, 300 - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

export async function duplicateIdea(id: string): Promise<Idea | undefined> {
  const src = await db.ideas.get(id);
  if (!src) return undefined;
  // A copy is new work: it starts gated, with no approvals, proof or link of its own.
  const copy = buildGated(
    { ...src, title: copyTitle(src.title), scheduledFor: null, scheduledTime: null },
    src.stage === 'published' ? 'ready' : src.stage,
  );
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
