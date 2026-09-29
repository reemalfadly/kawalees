import { Share2, X } from 'lucide-react';
import { animate, AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LogoMark } from '@/components/ui/Logo';
import { PlatformDot } from '@/components/ui/PlatformIcon';
import { useActivity, useLiveIdeas, usePillars, useSettings, useStats } from '@/hooks/data';
import { useLevel } from '@/hooks/useProgress';
import { PLATFORM_META } from '@/lib/catalog';
import { formatDate } from '@/lib/dates';
import { formatNumber, formatSigned, plural, WORDS } from '@/lib/format';
import { monthRecap } from '@/lib/stats';

/* "Wrapped"-style monthly story: tap to advance, hold to pause, share at the end. */

const DURATION = 5200;

function CountUp({ to, className }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const controls = animate(0, to, {
      duration: Math.min(1.6, 0.6 + to / 200),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = formatNumber(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [to]);
  return (
    <span ref={ref} className={`num ${className ?? ''}`}>
      0
    </span>
  );
}

interface Slide {
  id: string;
  bg: string;
  content: ReactNode;
}

function Big({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-[5.5rem] leading-none font-bold tracking-tight text-white sm:text-[7rem]">
      {children}
    </p>
  );
}
function Kicker({ children }: { children: ReactNode }) {
  return <p className="mb-5 text-lg font-medium text-white/75">{children}</p>;
}
function Line({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 font-display text-2xl leading-relaxed font-semibold text-white sm:text-3xl">
      {children}
    </p>
  );
}
function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 inline-block rounded-full bg-white/15 px-4 py-2 text-sm text-white/90 backdrop-blur">
      {children}
    </p>
  );
}

export default function RecapPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ideas = useLiveIdeas();
  const stats = useStats();
  const activity = useActivity();
  const pillars = usePillars();
  const settings = useSettings();
  const level = useLevel();

  const [y, m] = (params.get('m') ?? '').split('-').map(Number);
  const now = new Date();
  const year = y && y > 2000 ? y : now.getFullYear();
  const month = m && m >= 1 && m <= 12 ? m - 1 : now.getMonth();
  const monthDate = useMemo(() => new Date(year, month, 1), [year, month]);
  const monthName = formatDate.monthName(monthDate);

  const r = useMemo(
    () =>
      monthRecap(
        ideas,
        stats,
        activity.filter((a) => a.count > 0).map((a) => a.day),
        year,
        month,
      ),
    [ideas, stats, activity, year, month],
  );

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    list.push({
      id: 'intro',
      bg: 'linear-gradient(160deg,#1b1033 0%,#40125a 45%,#ff4d6d 100%)',
      content: (
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.4, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            className="mx-auto mb-8 w-fit"
          >
            <LogoMark size={110} />
          </motion.div>
          <p className="text-lg text-white/75">{settings.name ? `${settings.name}، هذا` : 'هذا'}</p>
          <p className="mt-2 font-display text-5xl font-bold text-white sm:text-6xl">
            {monthName} مالك
          </p>
          <p className="mt-4 text-white/70">في كواليس · {formatDate.monthYear(monthDate)}</p>
        </div>
      ),
    });
    const empty = r.ideasCreated === 0 && r.published === 0 && r.activeDays === 0;
    if (empty) {
      list.push({
        id: 'empty',
        bg: 'linear-gradient(160deg,#0f172a,#1e1b4b)',
        content: (
          <div>
            <Kicker>{monthName} كان هادي</Kicker>
            <Line>ما في نشاط مسجّل بهالشهر. والشهر الجاي فرصة جديدة ✨</Line>
          </div>
        ),
      });
    } else {
      list.push({
        id: 'ideas',
        bg: 'linear-gradient(160deg,#2e1065 0%,#6d28d9 55%,#a78bfa 100%)',
        content: (
          <div>
            <Kicker>بنك الأفكار كبر</Kicker>
            <Big>
              <CountUp to={r.ideasCreated} />
            </Big>
            <Line>
              {r.ideasCreated === 1 ? 'فكرة جديدة انولدت' : 'فكرة جديدة انولدت هالشهر'} 💡
            </Line>
            {r.prevIdeasCreated > 0 && (
              <Note>
                {r.ideasCreated >= r.prevIdeasCreated ? 'أكثر' : 'أقل'} من الشهر اللي قبله (
                <span className="num">{formatSigned(r.ideasCreated - r.prevIdeasCreated)}</span>)
              </Note>
            )}
          </div>
        ),
      });
      list.push({
        id: 'published',
        bg: 'linear-gradient(160deg,#431407 0%,#c2410c 50%,#ff3d7f 100%)',
        content: (
          <div>
            <Kicker>النشر</Kicker>
            <Big>
              <CountUp to={r.published} />
            </Big>
            <Line>
              {r.published === 0 ? 'ولا منشور… الشهر الجاي نعوضها 💪' : 'محتوى نزل للعالم 🚀'}
            </Line>
            {r.topPlatform && (
              <Note>
                <span className="inline-flex items-center gap-2">
                  <PlatformDot id={r.topPlatform.id} size={20} />
                  أكثر منصة: {PLATFORM_META[r.topPlatform.id].label} ({r.topPlatform.count})
                </span>
              </Note>
            )}
          </div>
        ),
      });
      if (r.wordsWritten > 0)
        list.push({
          id: 'words',
          bg: 'linear-gradient(160deg,#082f49 0%,#0369a1 50%,#6366f1 100%)',
          content: (
            <div>
              <Kicker>قلمك ما وقف</Kicker>
              <Big>
                <CountUp to={r.wordsWritten} />
              </Big>
              <Line>كلمة بالسكريبتات ✍️</Line>
              <Note>
                ≈ {Math.max(1, Math.round(r.wordsWritten / settings.wordsPerMinute))} دقيقة كلام
                قدام الكاميرا
              </Note>
            </div>
          ),
        });
      list.push({
        id: 'streak',
        bg: 'linear-gradient(160deg,#422006 0%,#b45309 50%,#f59e0b 100%)',
        content: (
          <div>
            <Kicker>الاستمرارية</Kicker>
            <Big>
              <CountUp to={r.activeDays} />
            </Big>
            <Line>يوم فيه خطوة إبداعية 🔥</Line>
            <div className="mt-6 flex flex-wrap gap-2">
              {r.bestStreak > 1 && <Note>أطول سلسلة: {plural(r.bestStreak, WORDS.day)}</Note>}
              {r.busiestWeekday != null && (
                <Note>
                  أنشط يوم: {formatDate.weekdayLong(new Date(2023, 0, 1 + r.busiestWeekday))}
                </Note>
              )}
            </div>
          </div>
        ),
      });
      const pillar = r.topPillarId ? pillars.find((p) => p.id === r.topPillarId?.id) : null;
      if (pillar)
        list.push({
          id: 'pillar',
          bg: 'linear-gradient(160deg,#052e16 0%,#047857 50%,#06b6d4 100%)',
          content: (
            <div className="text-center">
              <Kicker>المحور اللي سيطر</Kicker>
              <p className="text-8xl">{pillar.emoji}</p>
              <Line>{pillar.name}</Line>
              <Note>{plural(r.topPillarId!.count, WORDS.idea)} عنه</Note>
            </div>
          ),
        });
      const grow = [...r.followerGrowth].sort((a, b) => b.delta - a.delta)[0];
      if (grow && grow.delta !== 0)
        list.push({
          id: 'growth',
          bg: 'linear-gradient(160deg,#1e1b4b 0%,#be185d 55%,#f97316 100%)',
          content: (
            <div>
              <Kicker>
                <span className="inline-flex items-center gap-2">
                  <PlatformDot id={grow.platform} size={24} /> {PLATFORM_META[grow.platform].label}
                </span>
              </Kicker>
              <Big>
                {grow.delta > 0 ? '+' : '−'}
                <CountUp to={Math.abs(grow.delta)} />
              </Big>
              <Line>متابع {grow.delta > 0 ? 'جديد انضم 🎉' : 'بالفرق هالشهر'}</Line>
              <Note>
                من <span className="num">{formatNumber(grow.from)}</span> إلى{' '}
                <span className="num">{formatNumber(grow.to)}</span>
              </Note>
            </div>
          ),
        });
    }
    list.push({
      id: 'outro',
      bg: 'linear-gradient(160deg,#0b0b12 0%,#312e81 50%,#ff6b3d 100%)',
      content: (
        <div className="text-center">
          <p className="text-7xl">{level.emoji}</p>
          <p className="mt-6 text-lg text-white/75">المستوى {level.level}</p>
          <p className="font-display text-5xl font-bold text-white">{level.title}</p>
          {r.xpEarned > 0 && <Note>+{formatNumber(r.xpEarned)} نقطة خبرة بهالشهر</Note>}
          <Line>الشهر الجاي أقوى ✨</Line>
        </div>
      ),
    });
    return list;
  }, [r, monthName, monthDate, settings.name, settings.wordsPerMinute, pillars, level]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const last = slides.length - 1;
  const current = Math.min(index, last);

  const exit = useCallback(() => (history.length > 1 ? navigate(-1) : navigate('/')), [navigate]);
  const go = useCallback(
    (delta: number) => {
      setElapsed(0);
      setIndex((i) => Math.max(0, Math.min(last, Math.min(i, last) + delta)));
    },
    [last],
  );

  useEffect(() => {
    if (paused || current === last) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (t: number) => {
      const dt = t - prev;
      prev = t;
      setElapsed((e) => {
        const next = e + dt;
        if (next >= DURATION) {
          setIndex((i) => Math.min(last, i + 1));
          return 0;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, current, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === ' ') go(1);
      else if (e.key === 'ArrowRight') go(-1);
      else if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, exit]);

  const share = async () => {
    const text = [
      `ملخص ${monthName} في كواليس ✨`,
      `💡 ${plural(r.ideasCreated, WORDS.idea)}`,
      `🚀 ${plural(r.published, WORDS.post)} منشور`,
      `🔥 ${plural(r.activeDays, WORDS.day)} نشاط`,
      `${level.emoji} المستوى ${level.level}: ${level.title}`,
    ].join('\n');
    try {
      if (navigator.share) await navigator.share({ title: `ملخص ${monthName}`, text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* dismissed */
    }
  };

  const slide = slides[current]!;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black text-white">
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.id}
          className="absolute inset-0"
          style={{ background: slide.bg }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>
      <div className="aurora__noise absolute inset-0 opacity-[0.07]" aria-hidden />

      <div className="relative mx-auto flex h-full max-w-lg flex-col px-5 pt-[max(0.875rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-1.5" aria-hidden>
          {slides.map((s, i) => (
            <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full bg-white"
                style={{
                  width:
                    i < current
                      ? '100%'
                      : i === current
                        ? current === last
                          ? '100%'
                          : `${(elapsed / DURATION) * 100}%`
                        : '0%',
                }}
              />
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <LogoMark size={32} />
          <p className="flex-1 text-sm font-semibold">ملخص {monthName}</p>
          <button
            type="button"
            onClick={exit}
            aria-label="إغلاق"
            className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className="relative flex flex-1 items-center"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
        >
          <button
            type="button"
            aria-label="السابق"
            onClick={() => go(-1)}
            className="absolute inset-y-0 start-0 z-10 w-2/5"
          />
          <button
            type="button"
            aria-label="التالي"
            onClick={() => go(1)}
            className="absolute inset-y-0 end-0 z-10 w-3/5"
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              {slide.content}
            </motion.div>
          </AnimatePresence>
        </div>

        {current === last && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-20 flex gap-2.5"
          >
            <button
              type="button"
              onClick={() => void share()}
              className="flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-black transition-transform active:scale-95"
            >
              <Share2 size={18} /> مشاركة الملخص
            </button>
            <button
              type="button"
              onClick={() => go(-last)}
              className="h-13 rounded-2xl bg-white/15 px-5 font-semibold backdrop-blur"
            >
              من جديد
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
