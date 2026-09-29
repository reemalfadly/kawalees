import { describe, expect, it } from 'vitest';
import { buildIdea } from '@/lib/repo';
import {
  achievements,
  activityStreak,
  bestStreak,
  countByStage,
  followerSeries,
  heatmapWeeks,
  levelFromXp,
  monthRecap,
  nextStage,
  prevStage,
  publishedByWeek,
  seriesDelta,
  totalXp,
  upNext,
  weeklyGoalStreak,
  xpForLevel,
} from '@/lib/stats';
import type { Idea, StatEntry } from '@/lib/types';

const NOW = new Date(2026, 8, 28, 12); // Monday 28 Sep 2026

function idea(partial: Partial<Idea> & { title?: string } = {}): Idea {
  return { ...buildIdea({ title: partial.title ?? 'فكرة' }, NOW.getTime()), ...partial };
}

function publishedOn(y: number, m: number, d: number): Idea {
  return idea({ stage: 'published', publishedAt: new Date(y, m, d, 20).getTime() });
}

describe('levels', () => {
  it('uses a growing XP curve', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });

  it('maps XP to level, title and progress', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, title: 'شرارة', progress: 0 });
    expect(levelFromXp(150)).toMatchObject({ level: 2, floor: 100, ceil: 300, progress: 0.25 });
    expect(levelFromXp(1000).level).toBe(5);
    expect(levelFromXp(-50).level).toBe(1);
  });

  it('keeps the top title past the last named level', () => {
    expect(levelFromXp(xpForLevel(20)).title).toBe('أسطورة');
  });

  it('awards XP by stage, script length and stat logs', () => {
    const script = 'كلمة '.repeat(60);
    const xp = totalXp(
      [idea({ stage: 'idea' }), idea({ stage: 'published', body: script })],
      [
        {
          id: 's',
          date: '2026-09-28',
          platform: 'instagram',
          followers: 10,
          views: null,
          createdAt: 0,
        },
      ],
    );
    expect(xp).toBe(5 + 100 + 15 + 5);
  });
});

describe('streaks', () => {
  it('counts consecutive days ending today', () => {
    const days = new Set(['2026-09-26', '2026-09-27', '2026-09-28']);
    expect(activityStreak(days, '2026-09-28')).toBe(3);
  });

  it("keeps yesterday's streak alive until today ends", () => {
    const days = new Set(['2026-09-26', '2026-09-27']);
    expect(activityStreak(days, '2026-09-28')).toBe(2);
  });

  it('breaks on a missed day', () => {
    const days = new Set(['2026-09-25', '2026-09-27']);
    expect(activityStreak(days, '2026-09-28')).toBe(1);
    expect(activityStreak(new Set(['2026-09-20']), '2026-09-28')).toBe(0);
  });

  it('finds the best run, ignoring duplicates and order', () => {
    expect(bestStreak(['2026-09-03', '2026-09-01', '2026-09-02', '2026-09-02', '2026-09-10'])).toBe(
      3,
    );
    expect(bestStreak([])).toBe(0);
  });
});

describe('publishing cadence', () => {
  const ideas = [
    publishedOn(2026, 8, 28), // this week (week starts Sunday 27th)
    publishedOn(2026, 8, 22),
    publishedOn(2026, 8, 21),
    publishedOn(2026, 8, 15),
    publishedOn(2026, 8, 14),
    publishedOn(2026, 8, 1),
    idea({ stage: 'ready' }),
  ];

  it('buckets published ideas per week, oldest first', () => {
    const weeks = publishedByWeek(ideas, 0, 4, NOW);
    expect(weeks.map((w) => w.weekStart)).toEqual([
      '2026-09-06',
      '2026-09-13',
      '2026-09-20',
      '2026-09-27',
    ]);
    expect(weeks.map((w) => w.count)).toEqual([0, 2, 2, 1]);
  });

  it('counts consecutive weeks meeting the goal', () => {
    // Current week (1) misses a goal of 2 but does not break the streak.
    expect(weeklyGoalStreak(ideas, 2, 0, NOW)).toBe(2);
    expect(weeklyGoalStreak(ideas, 1, 0, NOW)).toBe(3);
    expect(weeklyGoalStreak(ideas, 5, 0, NOW)).toBe(0);
  });
});

describe('pipeline', () => {
  it('counts ideas per stage', () => {
    const counts = countByStage([idea(), idea({ stage: 'edit' }), idea({ stage: 'edit' })]);
    expect(counts).toMatchObject({ idea: 1, edit: 2, published: 0 });
  });

  it('walks stages in order', () => {
    expect(nextStage('idea')).toBe('script');
    expect(nextStage('published')).toBeNull();
    expect(prevStage('script')).toBe('idea');
    expect(prevStage('idea')).toBeNull();
  });

  it('puts dated work first, then the most recently touched', () => {
    const a = idea({ title: 'a', stage: 'shoot', updatedAt: 3 });
    const b = idea({ title: 'b', stage: 'edit', scheduledFor: '2026-10-02', updatedAt: 1 });
    const c = idea({ title: 'c', stage: 'script', scheduledFor: '2026-09-30', updatedAt: 1 });
    const skip = [
      idea({ stage: 'idea' }),
      idea({ stage: 'published' }),
      idea({ stage: 'edit', archived: true }),
    ];
    expect(upNext([a, b, c, ...skip]).map((i) => i.title)).toEqual(['c', 'b', 'a']);
  });
});

describe('audience numbers', () => {
  const stats: StatEntry[] = [
    {
      id: '1',
      date: '2026-09-01',
      platform: 'instagram',
      followers: 100,
      views: null,
      createdAt: 1,
    },
    {
      id: '2',
      date: '2026-09-08',
      platform: 'instagram',
      followers: 130,
      views: null,
      createdAt: 2,
    },
    {
      id: '3',
      date: '2026-09-08',
      platform: 'instagram',
      followers: 140,
      views: null,
      createdAt: 3,
    },
    { id: '4', date: '2026-09-08', platform: 'tiktok', followers: 9, views: null, createdAt: 4 },
  ];

  it('builds one point per day, keeping the latest entry', () => {
    expect(followerSeries(stats, 'instagram')).toEqual([
      { date: '2026-09-01', value: 100 },
      { date: '2026-09-08', value: 140 },
    ]);
  });

  it('reports the latest value and the change', () => {
    expect(seriesDelta(followerSeries(stats, 'instagram'))).toEqual({ latest: 140, delta: 40 });
    expect(seriesDelta(followerSeries(stats, 'tiktok'))).toEqual({ latest: 9, delta: null });
    expect(seriesDelta([])).toBeNull();
  });
});

describe('achievements', () => {
  it('unlocks by progress and caps the counter at the target', () => {
    const list = achievements({
      ideas: [publishedOn(2026, 8, 28), idea()],
      stats: [],
      activeDays: ['2026-09-27', '2026-09-28'],
      weeklyGoal: 1,
      weekStartsOn: 0,
      now: NOW,
    });
    const byId = Object.fromEntries(list.map((a) => [a.id, a]));
    expect(byId['first-spark']?.unlocked).toBe(true);
    expect(byId['first-publish']?.unlocked).toBe(true);
    expect(byId['golden-week']?.unlocked).toBe(true);
    expect(byId['streak-7']).toMatchObject({ unlocked: false, current: 2, target: 7 });
    expect(byId['first-spark']?.current).toBe(1);
  });
});

describe('monthly recap', () => {
  it('summarises the month and compares with the one before', () => {
    const created = (m: number, d: number, extra: Partial<Idea> = {}) =>
      idea({ createdAt: new Date(2026, m, d).getTime(), ...extra });
    const ideas = [
      created(8, 2, { pillarId: 'p1', body: 'واحد اثنين ثلاثة' }),
      created(8, 3, { pillarId: 'p1' }),
      created(8, 4, {
        stage: 'published',
        publishedAt: new Date(2026, 8, 5).getTime(),
        platforms: ['tiktok'],
      }),
      created(7, 20),
    ];
    const stats: StatEntry[] = [
      { id: 'a', date: '2026-08-28', platform: 'tiktok', followers: 50, views: null, createdAt: 1 },
      { id: 'b', date: '2026-09-20', platform: 'tiktok', followers: 80, views: null, createdAt: 2 },
    ];
    const r = monthRecap(ideas, stats, ['2026-09-02', '2026-09-03', '2026-09-10'], 2026, 8);
    expect(r).toMatchObject({
      ideasCreated: 3,
      prevIdeasCreated: 1,
      published: 1,
      wordsWritten: 3,
      activeDays: 3,
      bestStreak: 2,
      topPlatform: { id: 'tiktok', count: 1 },
      topPillarId: { id: 'p1', count: 2 },
    });
    expect(r.followerGrowth).toEqual([{ platform: 'tiktok', from: 50, to: 80, delta: 30 }]);
  });
});

describe('heatmap', () => {
  it('lays out whole weeks ending with the current one and marks future days', () => {
    const cols = heatmapWeeks(new Map([['2026-09-28', 4]]), 3, 0, NOW);
    expect(cols).toHaveLength(3);
    expect(cols.every((c) => c.length === 7)).toBe(true);
    const last = cols[2]!;
    expect(last[0]?.day).toBe('2026-09-27');
    expect(last[1]).toEqual({ day: '2026-09-28', count: 4, future: false });
    expect(last[2]?.future).toBe(true);
  });
});
