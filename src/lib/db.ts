import Dexie, { type EntityTable } from 'dexie';
import type { ActivityDay, ErrorEntry, Idea, Pillar, Settings, Snapshot, StatEntry } from './types';

/* Local-first storage: everything lives in the browser's IndexedDB, so the app
   works offline, opens instantly, and nothing leaves the device. */

export class StudioDB extends Dexie {
  ideas!: EntityTable<Idea, 'id'>;
  pillars!: EntityTable<Pillar, 'id'>;
  stats!: EntityTable<StatEntry, 'id'>;
  activity!: EntityTable<ActivityDay, 'day'>;
  settings!: EntityTable<Settings, 'id'>;
  errors!: EntityTable<ErrorEntry, 'id'>;
  snapshots!: EntityTable<Snapshot, 'id'>;

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
  }
}

export const db = new StudioDB();

/** Ask the browser not to evict our data under storage pressure (Safari especially). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
