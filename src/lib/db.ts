// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import Dexie, { type EntityTable } from 'dexie';
import type { ActivityDay, ErrorEntry, Idea, Pillar, Settings, Snapshot, StatEntry } from './types';

/** Small device-level facts that don't belong in the exported settings (last export, and so on). */
export interface MetaEntry {
  key: string;
  value: number | string | boolean;
}

/* Local-first storage: everything lives in the browser's IndexedDB, so the app
   works offline, opens instantly, and nothing leaves the device. (The one exception to
   "offline" is voice-follow in the prompter, which the browser processes at its provider.) */

export class StudioDB extends Dexie {
  ideas!: EntityTable<Idea, 'id'>;
  pillars!: EntityTable<Pillar, 'id'>;
  stats!: EntityTable<StatEntry, 'id'>;
  activity!: EntityTable<ActivityDay, 'day'>;
  settings!: EntityTable<Settings, 'id'>;
  errors!: EntityTable<ErrorEntry, 'id'>;
  snapshots!: EntityTable<Snapshot, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name = 'kawalees') {
    super(name);
    this.version(1).stores({
      ideas: 'id, stage, scheduledFor, publishedAt, pillarId, createdAt, updatedAt',
      pillars: 'id, order',
      stats: 'id, date, platform, [platform+date]',
      activity: 'day',
      settings: 'id',
      errors: '++id, at',
      snapshots: '++id, at',
    });
    // Version 2 only adds a table, so existing data needs no migration.
    this.version(2).stores({ meta: 'key' });
  }
}

export const db = new StudioDB();

/** Ask the browser not to evict our data under storage pressure (Safari especially).
    Safe where the API is missing: it just answers false. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Whether the browser already promised to keep our data, and whether it can be asked at all. */
export async function storagePersistence(): Promise<{ supported: boolean; persisted: boolean }> {
  try {
    if (!navigator.storage?.persisted) return { supported: false, persisted: false };
    return { supported: true, persisted: await navigator.storage.persisted() };
  } catch {
    return { supported: false, persisted: false };
  }
}
