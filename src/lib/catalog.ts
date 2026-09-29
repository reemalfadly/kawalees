import type { AccentId, Format, PlatformId, Stage } from './types';

/* Static product content: labels, colours and the creative prompt library. */

export interface StageMeta {
  id: Stage;
  label: string;
  verb: string;
  hint: string;
  color: string;
}

export const STAGE_META: Record<Stage, StageMeta> = {
  idea: {
    id: 'idea',
    label: 'فكرة',
    verb: 'كتابة السكريبت',
    hint: 'الفكرة محفوظة، الخطوة الجاية كتابة السكريبت',
    color: 'var(--stage-idea)',
  },
  script: {
    id: 'script',
    label: 'كتابة',
    verb: 'التصوير',
    hint: 'السكريبت جاهز تقريباً، الخطوة الجاية التصوير',
    color: 'var(--stage-script)',
  },
  shoot: {
    id: 'shoot',
    label: 'تصوير',
    verb: 'المونتاج',
    hint: 'انتهى التصوير؟ الخطوة الجاية المونتاج',
    color: 'var(--stage-shoot)',
  },
  edit: {
    id: 'edit',
    label: 'مونتاج',
    verb: 'التجهيز للنشر',
    hint: 'آخر لمسات المونتاج قبل النشر',
    color: 'var(--stage-edit)',
  },
  ready: {
    id: 'ready',
    label: 'جاهز',
    verb: 'النشر',
    hint: 'جاهز ينزل! باقي النشر',
    color: 'var(--stage-ready)',
  },
  published: {
    id: 'published',
    label: 'منشور',
    verb: '',
    hint: 'نزل للعالم',
    color: 'var(--stage-published)',
  },
};

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  latin: string;
  color: string;
  ink: string;
}

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  instagram: {
    id: 'instagram',
    label: 'إنستغرام',
    latin: 'Instagram',
    color: '#E1306C',
    ink: '#fff',
  },
  tiktok: { id: 'tiktok', label: 'تيك توك', latin: 'TikTok', color: '#111114', ink: '#fff' },
  youtube: { id: 'youtube', label: 'يوتيوب', latin: 'YouTube', color: '#FF0033', ink: '#fff' },
  snapchat: { id: 'snapchat', label: 'سناب شات', latin: 'Snapchat', color: '#FFFC00', ink: '#111' },
  x: { id: 'x', label: 'إكس', latin: 'X', color: '#1d1d22', ink: '#fff' },
  linkedin: { id: 'linkedin', label: 'لينكدإن', latin: 'LinkedIn', color: '#0A66C2', ink: '#fff' },
};

export const FORMAT_META: Record<Format, { label: string; emoji: string }> = {
  reel: { label: 'ريلز', emoji: '🎬' },
  short: { label: 'شورت', emoji: '⚡' },
  carousel: { label: 'كاروسيل', emoji: '🖼️' },
  story: { label: 'ستوري', emoji: '⭕' },
  long: { label: 'فيديو طويل', emoji: '📺' },
  post: { label: 'منشور', emoji: '📝' },
  live: { label: 'بث مباشر', emoji: '🔴' },
};

export const ACCENT_META: Record<AccentId, { label: string; from: string; to: string }> = {
  ember: { label: 'جمر', from: '#ff6b3d', to: '#ff3d7f' },
  violet: { label: 'بنفسج', from: '#8b5cf6', to: '#d946ef' },
  ocean: { label: 'محيط', from: '#0ea5e9', to: '#6366f1' },
  mint: { label: 'نعناع', from: '#10b981', to: '#06b6d4' },
  gold: { label: 'ذهب', from: '#f59e0b', to: '#ef4444' },
};

export const SPARK_LABELS: Record<1 | 2 | 3, string> = {
  1: 'فكرة عادية',
  2: 'فكرة قوية',
  3: 'فكرة نارية',
};

export const DEFAULT_PILLARS: { name: string; emoji: string }[] = [
  { name: 'تقنية وذكاء اصطناعي', emoji: '🤖' },
  { name: 'تطوير ذات', emoji: '🌱' },
  { name: 'خلف الكواليس', emoji: '🎬' },
  { name: 'نصائح سريعة', emoji: '💡' },
];

export const AVATARS = ['✨', '🎬', '🎙️', '📸', '🚀', '🌙', '🦋', '🔥', '🌿', '👑', '🎨', '💎'];

/** Creative prompts written as video titles in the creator's own voice. */
export const SPARK_PROMPTS: string[] = [
  'أكبر غلطة سويتها في بداياتي… وشنو تعلّمت منها',
  'قبل وبعد: وين كنت ووين صرت',
  '3 أدوات ما أستغني عنها يومياً',
  'سؤال يوصلني كثير… وجوابه الكامل',
  'خرافة منتشرة في مجالي لازم تنتهي',
  'يوم كامل معي خلف الكواليس',
  'شي تمنيت أحد قالي عنه من البداية',
  'جربت شي جديد لمدة أسبوع… وهذي النتيجة',
  'أسرع طريقة أنجز فيها شغلي',
  'ردة فعلي على أشهر نصيحة في مجالي',
  '5 أخطاء يقع فيها المبتدئين',
  'كيف أرتّب أسبوعي في صناعة المحتوى',
  'قصة فشل علّمتني أكثر من أي نجاح',
  'مقارنة سريعة بين أداتين أستخدمهم',
  'أداة ذكاء اصطناعي غيّرت طريقة شغلي',
  'سوّيت شي من الصفر بدون أي خبرة',
  'أسئلة المتابعين: جاوبت على كل شي',
  'الشي اللي ما أحد يقوله عن مجالي',
  'روتيني الصباحي بدون فلتر',
  'كم كلّفني هالمشروع فعلياً؟',
  'نصيحة بـ 10 ثواني ممكن تغيّر يومك',
  'ترند اليوم بطريقتي الخاصة',
  'شرح فكرة صعبة بأبسط طريقة ممكنة',
  'أول ما بدأت… والحين',
  'الكتاب اللي غيّر طريقة تفكيري',
  'تحدي 7 أيام مع المتابعين',
  'أشياء وقفت عنها وتغيّرت حياتي',
  'درس تعلّمته هالأسبوع',
  'لو أبدأ من جديد اليوم، بسوي كذا',
  'خلف الكواليس: كيف أصوّر فيديوهاتي',
];

/** Opening lines that stop the scroll. "___" marks the part to fill in. */
export const HOOK_TEMPLATES: string[] = [
  'أغلبنا يسوي ___ غلط… وهذا الصح',
  '3 أسرار عن ___ ما أحد يتكلم عنها',
  'هذي أسهل طريقة لـ ___ وما أحد انتبه لها',
  'جربت ___ لمدة 30 يوم… والنتيجة صدمتني',
  'لو عندك دقيقة وحدة، هذا أهم شي في ___',
  'هذا الخطأ كلّفني ___',
  'الفرق بين المبتدئ والمحترف في ___ هو هذا الشي',
  'سر ___ في 30 ثانية',
  'محد قال لك هذا عن ___',
  'إذا ودك في ___، هذا الفيديو لك',
  'توقعت ___… بس اللي صار كان العكس',
];

export const CTA_TEMPLATES: string[] = [
  'احفظ الفيديو ترجع له وقت الحاجة',
  'اكتب «___» بالتعليقات وأرسل لك التفاصيل',
  'شاركه مع شخص يحتاجه',
  'تابع الحساب عشان الجزء الثاني',
  'قولي رأيك بالتعليقات: ___ ولا ___؟',
];
