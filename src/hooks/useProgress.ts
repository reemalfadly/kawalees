import { useMemo } from 'react';
import { startOfWeek, toDayKey, todayKey } from '@/lib/dates';
import {
  activityStreak,
  bestStreak,
  levelFromXp,
  publishedByWeek,
  totalXp,
  weeklyGoalStreak,
  type LevelInfo,
} from '@/lib/stats';
import { useActivity, useLiveIdeas, useSettings, useStats } from './data';

export function useLevel(): LevelInfo {
  const ideas = useLiveIdeas();
  const stats = useStats();
  return useMemo(() => levelFromXp(totalXp(ideas, stats)), [ideas, stats]);
}

export function useStreak(): { current: number; best: number; activeToday: boolean } {
  const rows = useActivity();
  return useMemo(() => {
    const days = new Set(rows.filter((r) => r.count > 0).map((r) => r.day));
    const today = todayKey();
    return {
      current: activityStreak(days, today),
      best: bestStreak(days),
      activeToday: days.has(today),
    };
  }, [rows]);
}

export function useWeekProgress(): {
  published: number;
  goal: number;
  weekStart: string;
  goalStreak: number;
  history: { weekStart: string; count: number }[];
} {
  const ideas = useLiveIdeas();
  const { weeklyGoal, weekStartsOn } = useSettings();
  return useMemo(() => {
    const now = new Date();
    const history = publishedByWeek(ideas, weekStartsOn, 8, now);
    return {
      published: history[history.length - 1]?.count ?? 0,
      goal: weeklyGoal,
      weekStart: toDayKey(startOfWeek(now, weekStartsOn)),
      goalStreak: weeklyGoalStreak(ideas, weeklyGoal, weekStartsOn, now),
      history,
    };
  }, [ideas, weeklyGoal, weekStartsOn]);
}
