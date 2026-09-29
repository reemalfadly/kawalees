import { addDaysKey, diffDays, fromDayKey, startOfWeek, toDayKey, type WeekStart } from './dates';
import { scriptWords } from './script';
import { PLATFORMS, STAGES, type Idea, type PlatformId, type Stage, type StatEntry } from './types';

/* Pure derivations from the stored data. Nothing here touches the database,
   which keeps every number the app shows testable in isolation. */

// ── XP & levels ────────────────────────────────────────────────

export const STAGE_XP: Record<Stage, number> = {
  idea: 5,
  script: 15,
  shoot: 25,
  edit: 35,
  ready: 45,
  published: 100,
};
export const SCRIPT_BONUS_XP = 15;
export const SCRIPT_BONUS_WORDS = 50;
export const STAT_XP = 5;

export function ideaXp(idea: Idea): number {
  return STAGE_XP[idea.stage] + (scriptWords(idea) >= SCRIPT_BONUS_WORDS ? SCRIPT_BONUS_XP : 0);
}

export function totalXp(ideas: Idea[], stats: StatEntry[]): number {
  return ideas.reduce((sum, i) => sum + ideaXp(i), 0) + stats.length * STAT_XP;
}

export const LEVELS: { title: string; emoji: string }[] = [
  { title: 'شرارة', emoji: '✨' },
  { title: 'وهج', emoji: '🔥' },
  { title: 'نجمة', emoji: '⭐' },
  { title: 'كوكب', emoji: '🪐' },
  { title: 'مذنّب', emoji: '☄️' },
  { title: 'مجرّة', emoji: '🌌' },
  { title: 'سديم', emoji: '🌠' },
  { title: 'أسطورة', emoji: '👑' },
];

/** XP needed to reach a level: 0, 100, 300, 600, 1000, 1500… */
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * level;
}

export interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  xp: number;
  floor: number;
  ceil: number;
  progress: number;
}

export function levelFromXp(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpForLevel(level + 1) <= safe) level++;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const meta = LEVELS[Math.min(level, LEVELS.length) - 1] ?? LEVELS[LEVELS.length - 1]!;
  return {
    level,
    title: meta.title,
    emoji: meta.emoji,
    xp: safe,
    floor,
    ceil,
    progress: (safe - floor) / (ceil - floor),
  };
}

// ── Streaks ────────────────────────────────────────────────────

/** Consecutive active days ending today. Today not being active yet keeps yesterday's streak alive. */
export function activityStreak(activeDays: Set<string>, today: string): number {
  let cursor = activeDays.has(today) ? today : addDaysKey(today, -1);
  let streak = 0;
  while (activeDays.has(cursor)) {
    streak++;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

export function bestStreak(days: Iterable<string>): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && diffDays(d, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

// ── Publishing cadence ─────────────────────────────────────────

export function publishedDayKey(idea: Idea): string | null {
  return idea.publishedAt != null ? toDayKey(new Date(idea.publishedAt)) : null;
}

export interface WeekCount {
  weekStart: string;
  count: number;
}

/** Published counts for the last `weeks` weeks, oldest first, current week last. */
export function publishedByWeek(
  ideas: Idea[],
  weekStartsOn: WeekStart,
  weeks: number,
  now: Date = new Date(),
): WeekCount[] {
  const current = toDayKey(startOfWeek(now, weekStartsOn));
  const buckets = new Map<string, number>();
  for (let i = weeks - 1; i >= 0; i--) buckets.set(addDaysKey(current, -7 * i), 0);
  for (const idea of ideas) {
    const day = publishedDayKey(idea);
    if (!day) continue;
    const ws = toDayKey(startOfWeek(fromDayKey(day), weekStartsOn));
    if (buckets.has(ws)) buckets.set(ws, (buckets.get(ws) ?? 0) + 1);
  }
  return [...buckets].map(([weekStart, count]) => ({ weekStart, count }));
}

/** Consecutive weeks that hit the goal. The current week counts once it is met; until then it doesn't break the streak. */
export function weeklyGoalStreak(
  ideas: Idea[],
  goal: number,
  weekStartsOn: WeekStart,
  now: Date = new Date(),
): number {
  const weeks = publishedByWeek(ideas, weekStartsOn, 104, now);
  const current = weeks[weeks.length - 1];
  let streak = current && current.count >= goal ? 1 : 0;
  for (let i = weeks.length - 2; i >= 0; i--) {
    if ((weeks[i]?.count ?? 0) >= goal) streak++;
    else break;
  }
  return streak;
}

// ── Pipeline ───────────────────────────────────────────────────

export function countByStage(ideas: Idea[]): Record<Stage, number> {
  const out = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const i of ideas) out[i.stage]++;
  return out;
}

export function nextStage(stage: Stage): Stage | null {
  const idx = STAGES.indexOf(stage);
  return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1]! : null;
}

export function prevStage(stage: Stage): Stage | null {
  const idx = STAGES.indexOf(stage);
  return idx > 0 ? STAGES[idx - 1]! : null;
}

/** In-progress ideas ordered by what needs attention first: dated work, then the most recently touched. */
export function upNext(ideas: Idea[], limit = 5): Idea[] {
  return ideas
    .filter((i) => !i.archived && i.stage !== 'published' && i.stage !== 'idea')
    .sort((a, b) => {
      if (a.scheduledFor && b.scheduledFor) return a.scheduledFor.localeCompare(b.scheduledFor);
      if (a.scheduledFor) return -1;
      if (b.scheduledFor) return 1;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, limit);
}

// ── Audience numbers ───────────────────────────────────────────

export interface SeriesPoint {
  date: string;
  value: number;
}

export function followerSeries(stats: StatEntry[], platform: PlatformId): SeriesPoint[] {
  const byDay = new Map<string, StatEntry>();
  for (const s of stats) {
    if (s.platform !== platform) continue;
    const prev = byDay.get(s.date);
    if (!prev || s.createdAt > prev.createdAt) byDay.set(s.date, s);
  }
  return [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, value: s.followers }));
}

export function seriesDelta(
  series: SeriesPoint[],
): { latest: number; delta: number | null } | null {
  const last = series[series.length - 1];
  if (!last) return null;
  const prev = series[series.length - 2];
  return { latest: last.value, delta: prev ? last.value - prev.value : null };
}

// ── Achievements ───────────────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  current: number;
  target: number;
  unlocked: boolean;
}

export interface AchievementContext {
  ideas: Idea[];
  stats: StatEntry[];
  activeDays: Iterable<string>;
  weeklyGoal: number;
  weekStartsOn: WeekStart;
  now?: Date;
}

export function achievements(ctx: AchievementContext): Achievement[] {
  const now = ctx.now ?? new Date();
  const live = ctx.ideas.filter((i) => !i.archived);
  const published = live.filter((i) => i.stage === 'published');
  const scripts = live.filter((i) => scriptWords(i) >= SCRIPT_BONUS_WORDS).length;
  const scheduled = live.filter((i) => i.scheduledFor).length;
  const best = bestStreak(ctx.activeDays);
  const weeks = publishedByWeek(live, ctx.weekStartsOn, 104, now);
  const goldenWeeks = weeks.filter((w) => w.count >= ctx.weeklyGoal).length;
  const platforms = new Set(published.flatMap((i) => i.platforms)).size;

  const defs: Omit<Achievement, 'unlocked'>[] = [
    {
      id: 'first-spark',
      emoji: '💡',
      title: 'أول شرارة',
      description: 'سجّلت أول فكرة',
      current: live.length,
      target: 1,
    },
    {
      id: 'idea-bank',
      emoji: '🏦',
      title: 'بنك أفكار',
      description: '25 فكرة محفوظة',
      current: live.length,
      target: 25,
    },
    {
      id: 'first-publish',
      emoji: '🚀',
      title: 'أول نشر',
      description: 'نزّلت أول محتوى',
      current: published.length,
      target: 1,
    },
    {
      id: 'on-a-roll',
      emoji: '🌊',
      title: 'على الموجة',
      description: '10 محتويات منشورة',
      current: published.length,
      target: 10,
    },
    {
      id: 'content-machine',
      emoji: '⚙️',
      title: 'ماكينة محتوى',
      description: '50 محتوى منشور',
      current: published.length,
      target: 50,
    },
    {
      id: 'golden-pen',
      emoji: '🖋️',
      title: 'قلم ذهبي',
      description: '5 سكريبتات مكتملة',
      current: scripts,
      target: 5,
    },
    {
      id: 'streak-7',
      emoji: '🔥',
      title: '7 أيام نار',
      description: 'أسبوع كامل بدون انقطاع',
      current: best,
      target: 7,
    },
    {
      id: 'streak-30',
      emoji: '🌋',
      title: 'شهر بلا توقف',
      description: '30 يوم متواصل',
      current: best,
      target: 30,
    },
    {
      id: 'golden-week',
      emoji: '🏆',
      title: 'أسبوع ذهبي',
      description: 'حققت هدف النشر الأسبوعي',
      current: goldenWeeks,
      target: 1,
    },
    {
      id: 'planner',
      emoji: '🗓️',
      title: 'جدول مرتّب',
      description: '5 محتويات مجدولة',
      current: scheduled,
      target: 5,
    },
    {
      id: 'analyst',
      emoji: '📈',
      title: 'عين على الأرقام',
      description: '5 تسجيلات للأرقام',
      current: ctx.stats.length,
      target: 5,
    },
    {
      id: 'everywhere',
      emoji: '🌍',
      title: 'في كل مكان',
      description: 'نشرت على 3 منصات',
      current: platforms,
      target: 3,
    },
  ];
  return defs.map((d) => ({
    ...d,
    current: Math.min(d.current, d.target),
    unlocked: d.current >= d.target,
  }));
}

// ── Monthly recap ──────────────────────────────────────────────

export interface MonthRecap {
  year: number;
  month: number;
  ideasCreated: number;
  published: number;
  prevIdeasCreated: number;
  prevPublished: number;
  wordsWritten: number;
  activeDays: number;
  bestStreak: number;
  busiestWeekday: number | null;
  topPlatform: { id: PlatformId; count: number } | null;
  topPillarId: { id: string; count: number } | null;
  followerGrowth: { platform: PlatformId; from: number; to: number; delta: number }[];
  xpEarned: number;
}

function inMonth(ts: number, year: number, month: number): boolean {
  const d = new Date(ts);
  return d.getFullYear() === year && d.getMonth() === month;
}

function dayInMonth(key: string, year: number, month: number): boolean {
  const d = fromDayKey(key);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function monthRecap(
  ideas: Idea[],
  stats: StatEntry[],
  activeDays: string[],
  year: number,
  month: number,
): MonthRecap {
  const prev = new Date(year, month - 1, 1);
  const created = ideas.filter((i) => inMonth(i.createdAt, year, month));
  const published = ideas.filter(
    (i) => i.publishedAt != null && inMonth(i.publishedAt, year, month),
  );
  const days = activeDays.filter((d) => dayInMonth(d, year, month));

  const weekdayCounts = new Array<number>(7).fill(0);
  for (const i of [...created, ...published]) {
    const ts =
      i.publishedAt != null && inMonth(i.publishedAt, year, month) ? i.publishedAt : i.createdAt;
    const wd = new Date(ts).getDay();
    weekdayCounts[wd] = (weekdayCounts[wd] ?? 0) + 1;
  }
  const maxWd = Math.max(...weekdayCounts);
  const busiestWeekday = maxWd > 0 ? weekdayCounts.indexOf(maxWd) : null;

  const platformCounts = new Map<PlatformId, number>();
  for (const i of published)
    for (const p of i.platforms) platformCounts.set(p, (platformCounts.get(p) ?? 0) + 1);
  const topPlatformEntry = [...platformCounts].sort((a, b) => b[1] - a[1])[0];

  const pillarCounts = new Map<string, number>();
  for (const i of created)
    if (i.pillarId) pillarCounts.set(i.pillarId, (pillarCounts.get(i.pillarId) ?? 0) + 1);
  const topPillarEntry = [...pillarCounts].sort((a, b) => b[1] - a[1])[0];

  const followerGrowth: MonthRecap['followerGrowth'] = [];
  for (const platform of PLATFORMS) {
    const series = followerSeries(stats, platform);
    const within = series.filter((p) => dayInMonth(p.date, year, month));
    const last = within[within.length - 1];
    if (!last) continue;
    const before = series.filter((p) => fromDayKey(p.date) < new Date(year, month, 1));
    const start = before[before.length - 1] ?? within[0]!;
    followerGrowth.push({
      platform,
      from: start.value,
      to: last.value,
      delta: last.value - start.value,
    });
  }

  return {
    year,
    month,
    ideasCreated: created.length,
    published: published.length,
    prevIdeasCreated: ideas.filter((i) => inMonth(i.createdAt, prev.getFullYear(), prev.getMonth()))
      .length,
    prevPublished: ideas.filter(
      (i) => i.publishedAt != null && inMonth(i.publishedAt, prev.getFullYear(), prev.getMonth()),
    ).length,
    wordsWritten: created.reduce((sum, i) => sum + scriptWords(i), 0),
    activeDays: days.length,
    bestStreak: bestStreak(days),
    busiestWeekday,
    topPlatform: topPlatformEntry ? { id: topPlatformEntry[0], count: topPlatformEntry[1] } : null,
    topPillarId: topPillarEntry ? { id: topPillarEntry[0], count: topPillarEntry[1] } : null,
    followerGrowth,
    xpEarned:
      created.reduce((sum, i) => sum + ideaXp(i), 0) +
      stats.filter((s) => dayInMonth(s.date, year, month)).length * STAT_XP,
  };
}

/** Activity counts for a heatmap: `weeks` columns of 7 days ending with the current week. */
export function heatmapWeeks(
  activity: Map<string, number>,
  weeks: number,
  weekStartsOn: WeekStart,
  now: Date = new Date(),
): { day: string; count: number; future: boolean }[][] {
  const today = toDayKey(now);
  const currentStart = toDayKey(startOfWeek(now, weekStartsOn));
  const cols: { day: string; count: number; future: boolean }[][] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDaysKey(currentStart, -7 * w);
    cols.push(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDaysKey(start, i);
        return { day, count: activity.get(day) ?? 0, future: day > today };
      }),
    );
  }
  return cols;
}
