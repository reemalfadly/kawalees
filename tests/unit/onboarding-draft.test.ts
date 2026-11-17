// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { beforeEach, describe, expect, it } from 'vitest';
import { saveOnboardingDraft } from '@/features/onboarding/draft';
import { db } from '@/lib/db';
import { completeOnboarding, getSettings } from '@/lib/repo';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('onboarding draft', () => {
  it('saves the name before the next step shows, without finishing setup', async () => {
    await saveOnboardingDraft({ name: 'ريم', avatar: '🎬' });
    const saved = await db.settings.get('me');
    expect(saved).toMatchObject({ name: 'ريم', avatar: '🎬', onboarded: false });
    expect(saved?.createdAt).toBeGreaterThan(0);
  });

  it('keeps earlier answers when a later step saves more', async () => {
    await saveOnboardingDraft({ name: 'ريم' });
    await saveOnboardingDraft({ platforms: ['youtube'], weeklyGoal: 5 });
    expect(await getSettings()).toMatchObject({
      name: 'ريم',
      platforms: ['youtube'],
      weeklyGoal: 5,
      onboarded: false,
    });
  });

  it('never undoes a finished setup', async () => {
    await completeOnboarding({
      name: 'ريم',
      avatar: '✨',
      platforms: ['instagram'],
      weeklyGoal: 3,
    });
    const wrote = await saveOnboardingDraft({ name: 'غيرها', weeklyGoal: 9 });
    expect(wrote).toBe(false);
    expect(await getSettings()).toMatchObject({ name: 'ريم', weeklyGoal: 3, onboarded: true });
  });

  it('finishing while a draft is still being written ends up finished', async () => {
    await Promise.all([
      saveOnboardingDraft({ name: 'ريم' }),
      completeOnboarding({ name: 'ريم', avatar: '✨', platforms: ['tiktok'], weeklyGoal: 4 }),
      saveOnboardingDraft({ name: 'ريم', weeklyGoal: 4 }),
    ]);
    expect(await getSettings()).toMatchObject({ name: 'ريم', onboarded: true });
    expect(await db.pillars.count()).toBeGreaterThan(0);
  });
});
