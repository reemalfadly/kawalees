// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { db } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/lib/repo';
import type { PlatformId, Settings } from '@/lib/types';

/* The welcome steps are saved to the database as they are completed, so a name typed on step two
   is already on disk when step three appears, and survives a reload or a closed tab. The write
   happens in one transaction that backs off if setup has been finished (possibly from another
   tab), so a late draft can never undo a completed setup. */

export interface OnboardingDraft {
  name: string;
  avatar: string;
  platforms: PlatformId[];
  weeklyGoal: number;
}

/** Saves the draft into the settings row. Returns false when setup was already finished. */
export async function saveOnboardingDraft(draft: Partial<OnboardingDraft>): Promise<boolean> {
  return db.transaction('rw', db.settings, async () => {
    const saved = await db.settings.get('me');
    if (saved?.onboarded) return false;
    const current: Settings = saved
      ? { ...DEFAULT_SETTINGS, ...saved }
      : { ...DEFAULT_SETTINGS, createdAt: Date.now() };
    await db.settings.put({ ...current, ...draft, id: 'me', onboarded: false });
    return true;
  });
}
