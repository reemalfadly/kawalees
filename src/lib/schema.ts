// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { z } from 'zod';
import { ACCENTS, FORMATS, PLATFORMS, STAGES, THEMES } from './types';

/* Runtime validation for everything that enters the app from outside (backup
   files, snapshots). Kept apart from ./types so zod only loads when needed. */

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const timeKey = z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm');

export const ideaSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(300),
  notes: z.string().max(20_000).default(''),
  stage: z.enum(STAGES),
  platforms: z.array(z.enum(PLATFORMS)).max(PLATFORMS.length),
  format: z.enum(FORMATS),
  pillarId: z.string().nullable().default(null),
  spark: z.number().int().min(1).max(3),
  hook: z.string().max(5_000).default(''),
  body: z.string().max(50_000).default(''),
  cta: z.string().max(5_000).default(''),
  scheduledFor: dayKey.nullable().default(null),
  scheduledTime: timeKey.nullable().default(null),
  publishedAt: z.number().nullable().default(null),
  archived: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const pillarSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  emoji: z.string().max(8),
  order: z.number(),
});

export const statEntrySchema = z.object({
  id: z.string().min(1),
  date: dayKey,
  platform: z.enum(PLATFORMS),
  followers: z.number().int().min(0).max(1_000_000_000),
  views: z.number().int().min(0).max(100_000_000_000).nullable().default(null),
  createdAt: z.number(),
});

export const activityDaySchema = z.object({
  day: dayKey,
  count: z.number().int().min(0),
});

export const settingsSchema = z.object({
  id: z.literal('me'),
  name: z.string().max(40),
  avatar: z.string().max(8),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  weeklyGoal: z.number().int().min(1).max(21),
  theme: z.enum(THEMES),
  accent: z.enum(ACCENTS),
  weekStartsOn: z.union([z.literal(0), z.literal(1), z.literal(6)]),
  wordsPerMinute: z.number().int().min(80).max(260),
  celebrations: z.boolean().default(true),
  haptics: z.boolean().default(true),
  onboarded: z.boolean(),
  createdAt: z.number(),
});

export const backupSchema = z.object({
  app: z.literal('kawalees'),
  // Who made the app; older backup files don't have these.
  author: z.string().optional(),
  mark: z.string().optional(),
  schema: z.literal(1),
  exportedAt: z.string(),
  data: z.object({
    ideas: z.array(ideaSchema),
    pillars: z.array(pillarSchema),
    stats: z.array(statEntrySchema),
    activity: z.array(activityDaySchema),
    settings: settingsSchema.nullable(),
  }),
});
