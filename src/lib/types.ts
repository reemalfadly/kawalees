import type { z } from 'zod';
import type * as S from './schema';

/* Domain constants and types. The matching runtime schemas live in ./schema. */

export const STAGES = ['idea', 'script', 'shoot', 'edit', 'ready', 'published'] as const;
export type Stage = (typeof STAGES)[number];

export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat', 'x', 'linkedin'] as const;
export type PlatformId = (typeof PLATFORMS)[number];

export const FORMATS = ['reel', 'carousel', 'story', 'long', 'short', 'post', 'live'] as const;
export type Format = (typeof FORMATS)[number];

export const ACCENTS = ['ember', 'violet', 'ocean', 'mint', 'gold'] as const;
export type AccentId = (typeof ACCENTS)[number];

export const THEMES = ['system', 'dark', 'light'] as const;
export type ThemePref = (typeof THEMES)[number];

export type Idea = z.infer<typeof S.ideaSchema>;
export type Pillar = z.infer<typeof S.pillarSchema>;
export type StatEntry = z.infer<typeof S.statEntrySchema>;
export type ActivityDay = z.infer<typeof S.activityDaySchema>;
export type Settings = z.infer<typeof S.settingsSchema>;
export type Backup = z.infer<typeof S.backupSchema>;

export interface ErrorEntry {
  id?: number;
  at: number;
  message: string;
  stack: string;
  source: 'window' | 'promise' | 'react' | 'manual';
  route: string;
  count: number;
  version: string;
}

export interface Snapshot {
  id?: number;
  at: number;
  reason: SnapshotReason;
  counts: { ideas: number; stats: number };
  payload: string;
}

export type SnapshotReason =
  'daily' | 'before-import' | 'before-reset' | 'before-demo' | 'before-restore' | 'manual';
