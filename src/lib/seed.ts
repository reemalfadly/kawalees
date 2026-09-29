import { db } from './db';
import { DEFAULT_PILLARS } from './catalog';
import { addDays, toDayKey } from './dates';
import { buildIdea, getSettings, newId } from './repo';
import type { ActivityDay, Idea, Pillar, PlatformId, StatEntry } from './types';

/* Demo content so the app can be explored with a realistic month of work
   already in it. Deterministic for a given "now". */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const DEMO_IDEAS: {
  title: string;
  stage: Idea['stage'];
  platforms: PlatformId[];
  format: Idea['format'];
  pillar: number;
  spark: 1 | 2 | 3;
  hook?: string;
  body?: string;
  cta?: string;
  dayOffset?: number;
  time?: string;
  publishedDaysAgo?: number;
}[] = [
  {
    title: 'صوّرت محتوى أسبوع كامل في يوم واحد',
    stage: 'edit',
    platforms: ['instagram', 'tiktok'],
    format: 'reel',
    pillar: 0,
    spark: 3,
    hook: 'صوّرت سبع فيديوهات في يوم واحد… وهذي الطريقة بالضبط',
    body:
      'البداية كانت قائمة أفكار جاهزة، وسكريبت قصير لكل فكرة. ' +
      'جهزت ثلاث زوايا تصوير، وغيرت الملابس بين كل فيديو والثاني. ' +
      'والنتيجة سبع فيديوهات جاهزة للمونتاج، وأسبوع كامل بدون ضغط.',
    cta: 'اكتب «جدول» بالتعليقات وأرسل لك القالب',
    dayOffset: 1,
    time: '20:00',
  },
  {
    title: '3 إعدادات في كاميرا الجوال تفرق بالجودة',
    stage: 'script',
    platforms: ['instagram', 'youtube'],
    format: 'carousel',
    pillar: 0,
    spark: 3,
    hook: '3 إعدادات في كاميرا الجوال محد قال لك عنها',
    body: 'الأول: ضغطة طويلة تثبّت الإضاءة والتركيز. الثاني: التصوير بدقة 4K و30 إطار. الثالث: الشبكة تضبط التكوين.',
    dayOffset: 3,
    time: '19:30',
  },
  {
    title: 'روتيني الصباحي قبل التصوير',
    stage: 'shoot',
    platforms: ['tiktok', 'snapchat'],
    format: 'story',
    pillar: 2,
    spark: 2,
    dayOffset: 0,
    time: '09:00',
  },
  {
    title: 'أكبر غلطة سويتها في بداياتي',
    stage: 'ready',
    platforms: ['instagram'],
    format: 'reel',
    pillar: 1,
    spark: 3,
    hook: 'أكبر غلطة سويتها في بداياتي كلفتني سنة كاملة',
    body: 'كنت أنتظر الفكرة المثالية قبل ما أنشر. والحقيقة إن النشر المستمر هو اللي يعلمك.',
    cta: 'احفظ الفيديو ترجع له وقت الحاجة',
    dayOffset: 2,
    time: '21:00',
  },
  {
    title: 'مقارنة: أفضل تطبيقات المونتاج المجانية',
    stage: 'idea',
    platforms: ['youtube'],
    format: 'long',
    pillar: 0,
    spark: 2,
  },
  {
    title: 'تحدي 7 أيام مع المتابعين',
    stage: 'idea',
    platforms: ['instagram', 'tiktok'],
    format: 'reel',
    pillar: 1,
    spark: 3,
  },
  {
    title: 'كيف أكتب سكريبت في 10 دقايق',
    stage: 'idea',
    platforms: ['instagram'],
    format: 'carousel',
    pillar: 3,
    spark: 2,
  },
  {
    title: 'أسئلة المتابعين: جاوبت على كل شي',
    stage: 'idea',
    platforms: ['instagram'],
    format: 'live',
    pillar: 2,
    spark: 1,
  },
  {
    title: 'خلف الكواليس: كيف أصوّر بالجوال',
    stage: 'script',
    platforms: ['tiktok'],
    format: 'short',
    pillar: 2,
    spark: 2,
    dayOffset: 6,
  },
  {
    title: 'أداة ذكاء اصطناعي غيّرت شغلي',
    stage: 'published',
    platforms: ['instagram', 'tiktok'],
    format: 'reel',
    pillar: 0,
    spark: 3,
    publishedDaysAgo: 2,
  },
  {
    title: 'نصيحة بـ 10 ثواني للمبتدئين',
    stage: 'published',
    platforms: ['tiktok'],
    format: 'short',
    pillar: 3,
    spark: 2,
    publishedDaysAgo: 5,
  },
  {
    title: 'قبل وبعد: سنة من صناعة المحتوى',
    stage: 'published',
    platforms: ['instagram', 'youtube'],
    format: 'reel',
    pillar: 1,
    spark: 3,
    publishedDaysAgo: 8,
  },
  {
    title: 'كيف أرتب أسبوعي',
    stage: 'published',
    platforms: ['instagram'],
    format: 'carousel',
    pillar: 3,
    spark: 2,
    publishedDaysAgo: 10,
  },
  {
    title: 'شرح البرومبت الصح بأبسط طريقة',
    stage: 'published',
    platforms: ['youtube', 'x'],
    format: 'long',
    pillar: 0,
    spark: 2,
    publishedDaysAgo: 13,
  },
  {
    title: 'الكتاب اللي غيّر تفكيري',
    stage: 'published',
    platforms: ['instagram'],
    format: 'reel',
    pillar: 1,
    spark: 2,
    publishedDaysAgo: 16,
  },
  {
    title: 'ترند اليوم بطريقتي',
    stage: 'published',
    platforms: ['tiktok', 'snapchat'],
    format: 'short',
    pillar: 2,
    spark: 1,
    publishedDaysAgo: 20,
  },
  {
    title: '5 أخطاء يقع فيها المبتدئين',
    stage: 'published',
    platforms: ['instagram', 'linkedin'],
    format: 'carousel',
    pillar: 3,
    spark: 3,
    publishedDaysAgo: 24,
  },
];

const DEMO_TITLES = new Set(DEMO_IDEAS.map((d) => d.title));

/** True while the ideas are still the demo set, so the app can offer a clean start. */
export function isDemoData(ideas: readonly Pick<Idea, 'title'>[]): boolean {
  let hits = 0;
  for (const i of ideas) if (DEMO_TITLES.has(i.title) && ++hits >= 3) return true;
  return false;
}

export async function loadDemoData(now = new Date()): Promise<void> {
  const rand = rng(20260928);
  const settings = await getSettings();
  const pillars: Pillar[] = DEFAULT_PILLARS.map((p, order) => ({ id: newId(), ...p, order }));

  const ideas: Idea[] = DEMO_IDEAS.map((d, i) => {
    const createdAt = addDays(now, -(28 - i)).getTime() + Math.floor(rand() * 8) * 3_600_000;
    const publishedAt =
      d.publishedDaysAgo != null
        ? addDays(now, -d.publishedDaysAgo).setHours(19 + Math.floor(rand() * 3), 0, 0, 0)
        : null;
    const idea = buildIdea(
      {
        title: d.title,
        stage: d.stage,
        platforms: d.platforms,
        format: d.format,
        pillarId: pillars[d.pillar]?.id ?? null,
        spark: d.spark,
        hook: d.hook ?? '',
        body: d.body ?? '',
        cta: d.cta ?? '',
        scheduledFor:
          d.dayOffset != null
            ? toDayKey(addDays(now, d.dayOffset))
            : publishedAt != null
              ? toDayKey(new Date(publishedAt))
              : null,
        scheduledTime: d.time ?? null,
        publishedAt,
      },
      Math.min(createdAt, publishedAt ?? Infinity),
    );
    return { ...idea, updatedAt: publishedAt ?? now.getTime() - i * 3_600_000 };
  });

  const activity: ActivityDay[] = [];
  for (let back = 0; back < 120; back++) {
    const recent = back < 12;
    if (recent || rand() > 0.42) {
      activity.push({
        day: toDayKey(addDays(now, -back)),
        count: 1 + Math.floor(rand() * (recent ? 7 : 5)),
      });
    }
  }

  const stats: StatEntry[] = [];
  const bases: Partial<Record<PlatformId, number>> = {
    instagram: 18_400,
    tiktok: 9_600,
    youtube: 3_150,
  };
  for (const [platform, base] of Object.entries(bases) as [PlatformId, number][]) {
    let value = base;
    for (let w = 10; w >= 0; w--) {
      value += Math.round(base * (0.012 + rand() * 0.03));
      stats.push({
        id: newId(),
        platform,
        date: toDayKey(addDays(now, -w * 7)),
        followers: value,
        views: Math.round(value * (1.5 + rand() * 3)),
        createdAt: now.getTime() - w * 7 * 86_400_000,
      });
    }
  }

  await db.transaction(
    'rw',
    [db.ideas, db.pillars, db.stats, db.activity, db.settings],
    async () => {
      await Promise.all([
        db.ideas.clear(),
        db.pillars.clear(),
        db.stats.clear(),
        db.activity.clear(),
      ]);
      await db.pillars.bulkPut(pillars);
      await db.ideas.bulkPut(ideas);
      await db.stats.bulkPut(stats);
      await db.activity.bulkPut(activity);
      await db.settings.put({
        ...settings,
        platforms: ['instagram', 'tiktok', 'youtube', 'snapchat', 'x', 'linkedin'],
        onboarded: true,
        createdAt: settings.createdAt || now.getTime(),
      });
    },
  );
}
