// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { db } from './db';
import { DEFAULT_PILLARS } from './catalog';
import { addDays, toDayKey } from './dates';
import { buildIdea, getSettings, newId } from './repo';
import {
  STAGES,
  type ActivityDay,
  type Idea,
  type Pillar,
  type PlatformId,
  type StatEntry,
} from './types';

/* Demo content so the app can be explored with a realistic month of work
   already in it. Deterministic for a given "now".

   The demo is honest about the stage gates: every idea from «تصوير» onward is genuinely complete
   (hook, script, approvals, proof, post link as each stage needs), and every scheduled idea
   could really be scheduled. Ideas in «فكرة» and «كتابة» stay natural, and a few are left
   incomplete on purpose so the gates can be seen working. Proof names and links are placeholders. */

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
    cta: 'بالتعليق بكلمة «جدول» أرسل لكم القالب',
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
    hook: '3 إعدادات في كاميرا الجوال ما أحد تكلم عنها',
    body:
      'الأول: ضغطة طويلة على الشاشة تثبّت الإضاءة والتركيز، فما يتغير الإطار أثناء التصوير. ' +
      'الثاني: التصوير بدقة 4K و30 إطار، وهي أفضل موازنة بين الجودة والحجم. ' +
      'الثالث: تفعيل الشبكة يضبط التكوين ويبقي الأفق مستقيماً.',
    cta: 'حفظ المنشور للرجوع إليه وقت التصوير',
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
    hook: 'هذا روتيني الصباحي قبل أي تصوير',
    body:
      'أبدأ بكوب ماء وخمس دقائق من التمدد، ثم أراجع قائمة اللقطات المطلوبة لليوم. ' +
      'بعدها أجهز الإضاءة والصوت وأجرب لقطة قصيرة، وأتأكد أن البطارية والمساحة تكفيان. ' +
      'هذا الترتيب يوفر عليّ ساعة كاملة من التوتر.',
    cta: 'متابعة الحساب لمشاهدة بقية الروتين',
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
    body:
      'كنت أنتظر الفكرة المثالية قبل ما أنشر. والحقيقة إن النشر المستمر هو اللي يعلّمنا، ' +
      'لأن كل فيديو يكشف شي جديد عن الجمهور. بعد ما غيّرت هالعادة صار عندي أكثر من 30 فيديو ' +
      'في أشهر قليلة، وتحسّن مستواي مع كل واحد.',
    cta: 'حفظ الفيديو للرجوع إليه وقت الحاجة',
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
    // Left incomplete on purpose: blanks remain, so the script gate (and scheduling) says no.
    hook: 'كيف أصوّر بالجوال بدون معدات إضافية',
    body: 'الأول: ___. الثاني: ___.',
  },
  {
    title: 'أداة ذكاء اصطناعي غيّرت شغلي',
    stage: 'published',
    platforms: ['instagram', 'tiktok'],
    format: 'reel',
    pillar: 0,
    spark: 3,
    hook: 'أداة وحدة غيّرت طريقة شغلي بالكامل',
    body: 'كنت أقضي ساعتين في تلخيص الأفكار وترتيبها قبل كل فيديو. اليوم أعطي الأداة الفكرة الأولية، وأراجع الناتج وأعدّله بصوتي أنا. صار الوقت أقل من نصف ساعة، وبقيت الأفكار أصلية لأن القرار الأخير دائماً لي.',
    cta: 'مشاركة الفيديو مع شخص يحتاجه',
    publishedDaysAgo: 2,
  },
  {
    title: 'نصيحة بـ 10 ثواني للمبتدئين',
    stage: 'published',
    platforms: ['tiktok'],
    format: 'short',
    pillar: 3,
    spark: 2,
    hook: 'نصيحة في 10 ثواني توفر على المبتدئين سنة كاملة',
    body: 'أهم نصيحة للمبتدئين هي البدء بما هو متاح اليوم، لا بما يُتوقع أن يتوفر لاحقاً. الجوال الحالي يكفي، والإضاءة قرب النافذة تكفي، والفكرة البسيطة تكفي. التحسين يأتي مع التكرار لا مع الانتظار.',
    cta: 'متابعة الحساب لنصيحة جديدة كل أسبوع',
    publishedDaysAgo: 5,
  },
  {
    title: 'قبل وبعد: سنة من صناعة المحتوى',
    stage: 'published',
    platforms: ['instagram', 'youtube'],
    format: 'reel',
    pillar: 1,
    spark: 3,
    hook: 'هذا الفرق بين أول فيديو وفيديو اليوم',
    body: 'في أول فيديو كان الصوت مشوشاً والإضاءة ضعيفة، وكنت أقرأ من الورقة طوال الوقت. خلال سنة تغيّر كل شي: صوت أنظف، وإضاءة أفضل، وكلام أقرب للعفوية. والسبب الوحيد هو النشر المستمر وتقييم كل فيديو بعد خروجه.',
    cta: 'حفظ الفيديو للرجوع إليه وقت الحاجة',
    publishedDaysAgo: 8,
  },
  {
    title: 'كيف أرتب أسبوعي',
    stage: 'published',
    platforms: ['instagram'],
    format: 'carousel',
    pillar: 3,
    spark: 2,
    hook: 'ترتيب الأسبوع بطريقة تناسب صانع المحتوى',
    body: 'أخصص يوماً للأفكار، ويوماً للكتابة، ويوماً للتصوير، ويوماً للمونتاج، وأترك يوماً للنشر والتفاعل. بهذا التقسيم لا تتداخل المهام، ولا أحتاج إلى اتخاذ القرار من جديد كل صباح. وأحتفظ بيوم فارغ للأمور الطارئة.',
    cta: 'مشاركة المنشور مع شخص يحتاج ترتيباً',
    publishedDaysAgo: 10,
  },
  {
    title: 'شرح البرومبت الصح بأبسط طريقة',
    stage: 'published',
    platforms: ['youtube', 'x'],
    format: 'long',
    pillar: 0,
    spark: 2,
    hook: 'البرومبت الصح يتكون من ثلاثة أجزاء فقط',
    body: 'الجزء الأول هو الدور: من المطلوب أن تكون الأداة. الجزء الثاني هو المهمة: ما المطلوب بالضبط وبأي شكل. الجزء الثالث هو السياق: لمن الناتج ولأي هدف. هذه الأجزاء الثلاثة تحوّل طلباً عاماً إلى نتيجة قابلة للاستخدام مباشرة.',
    cta: 'رأيكم بالتعليقات: أي جزء من الثلاثة ينقصكم؟',
    publishedDaysAgo: 13,
  },
  {
    title: 'الكتاب اللي غيّر تفكيري',
    stage: 'published',
    platforms: ['instagram'],
    format: 'reel',
    pillar: 1,
    spark: 2,
    hook: 'كتاب واحد غيّر طريقة تفكيري في العمل',
    body: 'قرأته في أسبوعين، وكنت أدوّن في كل فصل فكرة واحدة فقط. أهم ما خرجت به أن الاستمرار أهم من الحماس، وأن العادات الصغيرة تتراكم بصمت. طبّقت فكرة واحدة كل أسبوع، وبعد شهرين لاحظت الفرق في إنتاجي.',
    cta: 'متابعة الحساب لمراجعات الكتب القادمة',
    publishedDaysAgo: 16,
  },
  {
    title: 'ترند اليوم بطريقتي',
    stage: 'published',
    platforms: ['tiktok', 'snapchat'],
    format: 'short',
    pillar: 2,
    spark: 1,
    hook: 'دخلت الترند اليوم بطريقتي الخاصة',
    body: 'بدل تقليد الترند كما هو، أخذت فكرته الأساسية وأعدت صياغتها بما يخص مجالي. بقي الإيقاع نفسه، لكن المحتوى صار مفيداً لمتابعيني. النتيجة كانت تفاعلاً أعلى من المعتاد، وأفكاراً جديدة للفيديوهات القادمة.',
    cta: 'رأيكم بالتعليقات: تقليد الترند أم تطويعه؟',
    publishedDaysAgo: 20,
  },
  {
    title: '5 أخطاء يقع فيها المبتدئين',
    stage: 'published',
    platforms: ['instagram', 'linkedin'],
    format: 'carousel',
    pillar: 3,
    spark: 3,
    hook: '5 أخطاء يقع فيها أغلب المبتدئين',
    body: 'الخطأ الأول: انتظار الجودة الكاملة قبل النشر. الثاني: تقليد الآخرين بدل البحث عن أسلوب خاص. الثالث: تجاهل أرقام الفيديوهات السابقة. الرابع: النشر بلا خطة. الخامس: التوقف بعد أول فيديو ضعيف. تفادي هذه الأخطاء يختصر شهوراً من التجربة.',
    cta: 'حفظ المنشور للرجوع إليه',
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

/** Where each stage's approval falls between the idea's birth and its end, as a share of that span. */
const APPROVAL_AT = { shoot: 0.4, edit: 0.7, ready: 1 } as const;

/** Approvals, proof and post link an idea honestly carries for the stage it sits in: leaving a stage
    is what gets approved, so an idea in «مونتاج» has only the shoot approval. Ideas before
    «تصوير» get an empty record so they are never treated as saved before gates existed. */
function demoProgress(
  d: (typeof DEMO_IDEAS)[number],
  index: number,
  createdAt: number,
  end: number,
  publishedAt: number | null,
): Pick<Idea, 'approvals' | 'proof' | 'publishedUrl'> {
  const at = STAGES.indexOf(d.stage);
  const approvals: NonNullable<Idea['approvals']> = {};
  for (const stage of ['shoot', 'edit', 'ready'] as const) {
    if (at <= STAGES.indexOf(stage)) continue;
    approvals[stage] =
      stage === 'ready' && publishedAt != null
        ? publishedAt
        : Math.round(createdAt + (end - createdAt) * APPROVAL_AT[stage]);
  }
  // The video and post links are optional, so a few demo ideas go without them.
  const leavesLinksOut = index % 3 === 2;
  const name = `${d.format}-${String(index + 1).padStart(2, '0')}`;
  return {
    approvals,
    ...(at > STAGES.indexOf('edit') && !leavesLinksOut
      ? { proof: `${name}-final.${d.format === 'carousel' ? 'pdf' : 'mp4'}` }
      : {}),
    ...(at > STAGES.indexOf('ready') && !leavesLinksOut
      ? { publishedUrl: `https://example.com/demo/${name}` }
      : {}),
  };
}

export async function loadDemoData(now = new Date()): Promise<void> {
  const rand = rng(20260928);
  const settings = await getSettings();
  const pillars: Pillar[] = DEFAULT_PILLARS.map((p, order) => ({ id: newId(), ...p, order }));

  const nowMs = now.getTime();
  const ideas: Idea[] = DEMO_IDEAS.map((d, i) => {
    const sparked = addDays(now, -(28 - i)).getTime() + Math.floor(rand() * 8) * 3_600_000;
    const publishedAt =
      d.publishedDaysAgo != null
        ? addDays(now, -d.publishedDaysAgo).setHours(19 + Math.floor(rand() * 3), 0, 0, 0)
        : null;
    // A published idea took 4 to 7 days from first spark to the live post.
    const createdAt =
      publishedAt != null ? Math.min(sparked, publishedAt - (4 + (i % 4)) * 86_400_000) : sparked;
    const progress = demoProgress(d, i, createdAt, publishedAt ?? nowMs - 3_600_000, publishedAt);
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
        ...progress,
      },
      createdAt,
    );
    return { ...idea, updatedAt: publishedAt ?? nowMs - i * 3_600_000 };
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
