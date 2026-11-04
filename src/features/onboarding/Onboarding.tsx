// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clapperboard,
  Minus,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { GlyphTile } from '@/components/ui/GlyphTile';
import { LogoMark } from '@/components/ui/Logo';
import { PlatformDot } from '@/components/ui/PlatformIcon';
import { AUTHOR } from '@/lib/about';
import { AVATARS, PLATFORM_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { completeOnboarding } from '@/lib/repo';
import { loadDemoData } from '@/lib/seed';
import { PLATFORMS, type PlatformId } from '@/lib/types';
import { useUI } from '@/store/ui';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'بنك أفكار ما ينسى',
    text: 'كل فكرة تنحفظ بثانية، ومعها شرارات جاهزة لما يوقف الإلهام',
    from: '#a78bfa',
    to: '#7c3aed',
  },
  {
    icon: Clapperboard,
    title: 'من الفكرة للنشر',
    text: 'سكريبت منظم، ولوحة مراحل، وشاشة قراءة وقت التصوير',
    from: '#ff8a4c',
    to: '#ff3d7f',
  },
  {
    icon: CalendarDays,
    title: 'جدول نشر واضح',
    text: 'تقويم يوريك وش ينزل ومتى، على كل المنصات',
    from: '#38bdf8',
    to: '#4f46e5',
  },
  {
    icon: TrendingUp,
    title: 'أرقامك وإنجازاتك',
    text: 'نمو المتابعين، وسلسلة الأيام، والمستويات، وملخص شهري',
    from: '#34d399',
    to: '#0d9488',
  },
];

const STEPS = 4;

export default function Onboarding() {
  const setInstallOpen = useUI((s) => s.setInstallOpen);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('✨');
  const [platforms, setPlatforms] = useState<PlatformId[]>(['instagram', 'tiktok']);
  const [goal, setGoal] = useState(3);
  const [busy, setBusy] = useState(false);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    haptics.tap();
  };

  const finish = async () => {
    setBusy(true);
    await completeOnboarding({ name: name.trim(), avatar, platforms, weeklyGoal: goal });
    haptics.success();
  };

  // Presentation mode, never shown in the UI: #/?demo=1 opens with a month of sample work
  // (used for screenshots, live demos and the end-to-end tests).
  const [params] = useSearchParams();
  const presentation = params.get('demo') === '1';
  useEffect(() => {
    if (presentation) void loadDemoData();
  }, [presentation]);

  const canNext = step !== 2 || platforms.length > 0;

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between">
        <div className="flex h-10 items-center">
          {step > 0 && (
            <button
              type="button"
              onClick={() => go(step - 1)}
              aria-label="رجوع"
              className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
            >
              <ArrowRight size={20} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5" aria-label={`الخطوة ${step + 1} من ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-500',
                i === step
                  ? 'w-7 bg-accent-gradient'
                  : i < step
                    ? 'w-1.5 bg-accent'
                    : 'w-1.5 bg-line-2',
              )}
            />
          ))}
        </div>
        <div className="w-10" />
      </div>

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-8">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * -36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * 36 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                  className="relative mx-auto mb-7 w-fit"
                >
                  <div
                    className="absolute inset-0 -z-10 scale-[2.2] rounded-full bg-accent-soft blur-3xl"
                    aria-hidden
                  />
                  <LogoMark size={96} />
                </motion.div>
                <h1 className="font-display text-4xl font-bold text-ink md:text-5xl">
                  أهلاً في <span className="text-gradient">كواليس</span>
                </h1>
                <p className="mx-auto mt-3 max-w-md text-[17px] leading-8 text-ink-2">
                  استوديو صانع المحتوى. أفكارك، سكريبتاتك، جدول نشرك، وأرقامك… في مكان واحد.
                </p>
                <ul className="mt-9 grid gap-3 text-start sm:grid-cols-2">
                  {FEATURES.map((f, i) => (
                    <motion.li
                      key={f.title}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                      className="glass flex gap-3.5 rounded-2xl p-4"
                    >
                      <GlyphTile icon={f.icon} from={f.from} to={f.to} />
                      <div>
                        <p className="font-semibold text-ink">{f.title}</p>
                        <p className="mt-0.5 text-sm leading-6 text-ink-3">{f.text}</p>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">شنو اسمك؟</h2>
                <p className="mt-2 text-ink-2">عشان نرحّب فيك صح كل يوم</p>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && go(2)}
                  placeholder="الاسم"
                  aria-label="الاسم"
                  maxLength={40}
                  className="mt-7 h-15 text-xl"
                />
                <p className="mt-8 mb-3 text-sm font-medium text-ink-2">اختيار رمز</p>
                <div className="grid grid-cols-6 gap-2.5">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      aria-label={`الرمز ${a}`}
                      aria-pressed={avatar === a}
                      onClick={() => {
                        setAvatar(a);
                        haptics.tap();
                      }}
                      className={cn(
                        'grid aspect-square place-items-center rounded-2xl border text-2xl transition-all active:scale-90',
                        avatar === a
                          ? 'border-accent bg-accent-soft shadow-[0_0_0_4px_var(--accent-softer)]'
                          : 'border-line bg-surface hover:bg-surface-2',
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="font-display text-3xl font-bold text-ink">منصات النشر</h2>
                <p className="mt-2 text-ink-2">نختار المنصات، ونقدر نعدّلها بعدين من الإعدادات</p>
                <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {PLATFORMS.map((p) => {
                    const on = platforms.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]));
                          haptics.tap();
                        }}
                        className={cn(
                          'relative flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all active:scale-95',
                          on
                            ? 'border-accent bg-accent-softer shadow-[0_0_0_4px_var(--accent-softer)]'
                            : 'border-line bg-surface hover:bg-surface-2',
                        )}
                      >
                        <PlatformDot id={p} size={44} />
                        <span className="font-medium text-ink">{PLATFORM_META[p].label}</span>
                        {on && (
                          <span className="absolute top-2.5 end-2.5 grid size-5 place-items-center rounded-full bg-accent text-white">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center">
                <h2 className="font-display text-3xl font-bold text-ink">هدف النشر الأسبوعي</h2>
                <p className="mt-2 text-ink-2">كم محتوى بالأسبوع؟ الاستمرارية أهم من الكثرة</p>
                <div className="mt-10 flex items-center justify-center gap-6">
                  <button
                    type="button"
                    aria-label="تقليل"
                    onClick={() => setGoal((g) => Math.max(1, g - 1))}
                    className="grid size-14 place-items-center rounded-2xl border border-line bg-surface text-ink transition-transform active:scale-90"
                  >
                    <Minus size={22} />
                  </button>
                  <motion.div
                    key={goal}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                    className="w-28"
                  >
                    <span className="block font-display text-7xl font-bold text-gradient">
                      {goal}
                    </span>
                    <span className="text-sm text-ink-3">بالأسبوع</span>
                  </motion.div>
                  <button
                    type="button"
                    aria-label="زيادة"
                    onClick={() => setGoal((g) => Math.min(21, g + 1))}
                    className="grid size-14 place-items-center rounded-2xl border border-line bg-surface text-ink transition-transform active:scale-90"
                  >
                    <Plus size={22} />
                  </button>
                </div>
                <div className="mt-8 flex justify-center gap-2">
                  {[
                    { n: 2, l: 'هادي' },
                    { n: 3, l: 'متوازن' },
                    { n: 5, l: 'طموح' },
                    { n: 7, l: 'يومي' },
                  ].map((o) => (
                    <button
                      key={o.n}
                      type="button"
                      onClick={() => setGoal(o.n)}
                      className={cn(
                        'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                        goal === o.n
                          ? 'border-transparent bg-accent-soft text-accent-ink'
                          : 'border-line text-ink-2 hover:bg-surface-2',
                      )}
                    >
                      {o.l} · {o.n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {step < STEPS - 1 ? (
          <Button
            variant="primary"
            size="lg"
            block
            disabled={!canNext}
            onClick={() => go(step + 1)}
            iconEnd={<ArrowLeft size={20} />}
          >
            {step === 0 ? 'يلا نبدأ' : 'التالي'}
          </Button>
        ) : (
          <Button variant="primary" size="lg" block disabled={busy} onClick={finish}>
            يلا نبدع 🚀
          </Button>
        )}
        {step === 0 && (
          <button
            type="button"
            onClick={() => setInstallOpen(true)}
            className="mx-auto text-sm font-medium text-accent-ink hover:underline"
          >
            طريقة تثبيت كواليس على الجوال والكمبيوتر
          </button>
        )}
        {step === 0 && (
          <p dir="ltr" className="mt-1 text-center text-xs text-ink-3">
            By: {AUTHOR}
          </p>
        )}
      </div>
    </div>
  );
}
