import { FlipHorizontal2, Minus, Pause, Play, Plus, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useIdea } from '@/hooks/data';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/script';

/* Teleprompter: the script scrolls by itself past a reading line while you film.
   Keeps the screen awake, mirrors for prompter glass, and remembers your setup. */

const PREFS_KEY = 'kawalees:prompter';
interface Prefs {
  size: number;
  speed: number;
  mirror: boolean;
}
const DEFAULTS: Prefs = { size: 40, speed: 4, mirror: false };

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

/** Speed steps 1–10 → pixels per second. */
const pxPerSecond = (speed: number) => 14 + speed * 16;

type WakeLock = { release: () => Promise<void> };

export default function PrompterPage() {
  const { id } = useParams();
  const idea = useIdea(id);
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [remainingPx, setRemainingPx] = useState(0);
  const [chrome, setChrome] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const exact = useRef(0);
  const wake = useRef<WakeLock | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const exit = useCallback(
    () => navigate(id ? `/idea/${id}` : '/ideas', { replace: true }),
    [navigate, id],
  );

  // Scroll loop.
  useEffect(() => {
    if (!playing) return;
    const el = scroller.current;
    if (!el) return;
    exact.current = el.scrollTop;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      exact.current += pxPerSecond(prefs.speed) * dt;
      el.scrollTop = exact.current;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, prefs.speed]);

  // Keep the screen on while recording.
  useEffect(() => {
    if (!playing) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<WakeLock> };
    };
    nav.wakeLock
      ?.request('screen')
      .then((l) => {
        wake.current = l;
      })
      .catch(() => {});
    return () => {
      void wake.current?.release().catch(() => {});
      wake.current = null;
    };
  }, [playing]);

  // Controls fade away while playing; any touch brings them back.
  const poke = useCallback(() => {
    setChrome(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 2600);
  }, []);

  const start = useCallback(() => {
    setCountdown(3);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    const t = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        setPlaying(true);
        poke();
      } else setCountdown(countdown - 1);
    }, 700);
    return () => window.clearTimeout(t);
  }, [countdown, poke]);

  const toggle = useCallback(() => {
    if (countdown !== null) {
      setCountdown(null);
      return;
    }
    if (playing) {
      setPlaying(false);
      setChrome(true);
    } else start();
  }, [countdown, playing, start]);

  const restart = () => {
    setPlaying(false);
    scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape') exit();
      else if (e.key === 'ArrowUp') setPrefs((p) => ({ ...p, speed: Math.min(10, p.speed + 1) }));
      else if (e.key === 'ArrowDown') setPrefs((p) => ({ ...p, speed: Math.max(1, p.speed - 1) }));
      else if (e.key === '+' || e.key === '=')
        setPrefs((p) => ({ ...p, size: Math.min(88, p.size + 4) }));
      else if (e.key === '-') setPrefs((p) => ({ ...p, size: Math.max(20, p.size - 4) }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, exit]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? el.scrollTop / max : 0);
    setRemainingPx(Math.max(0, max - el.scrollTop));
  }, []);

  // Measure once the script has rendered (and again if the text size changes).
  useEffect(() => {
    const raf = requestAnimationFrame(onScroll);
    return () => cancelAnimationFrame(raf);
  }, [onScroll, prefs.size, idea]);

  useEffect(() => {
    if (idea === null) exit();
  }, [idea, exit]);

  if (!idea) return <div className="fixed inset-0 bg-[#050507]" />;

  const sections = [
    { label: 'الخطّاف', text: idea.hook },
    { label: 'المحتوى', text: idea.body },
    { label: 'الدعوة للتفاعل', text: idea.cta },
  ].filter((s) => s.text.trim());

  const remaining = remainingPx / pxPerSecond(prefs.speed);

  const showChrome = chrome || !playing;

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#050507] text-white"
      onPointerMove={playing ? poke : undefined}
    >
      {/* Reading line + fades */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[30vh] bg-gradient-to-b from-[#050507] via-[#050507]/85 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[35vh] bg-gradient-to-t from-[#050507] via-[#050507]/80 to-transparent" />
      <div
        className="pointer-events-none absolute inset-x-1.5 top-[36vh] z-10 flex -translate-y-1/2 items-center gap-3"
        aria-hidden
      >
        <span className="size-0 border-y-[6px] border-s-[9px] border-y-transparent border-s-[var(--accent)]" />
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-transparent" />
        <span className="size-0 border-y-[6px] border-e-[9px] border-y-transparent border-e-[var(--accent)]" />
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        onClick={toggle}
        className="no-scrollbar h-dvh overflow-y-auto"
        style={{ transform: prefs.mirror ? 'scaleX(-1)' : undefined }}
      >
        <div className="mx-auto max-w-4xl px-7 pt-[36vh] pb-[70vh] md:px-12">
          {sections.map((s) => (
            <section key={s.label} className="mb-[1.2em]" style={{ fontSize: prefs.size }}>
              <p className="mb-3 font-sans text-sm font-semibold tracking-wide text-[var(--accent-ink-d)]">
                {s.label}
              </p>
              <p className="font-display leading-[1.55] font-semibold whitespace-pre-wrap text-white/95">
                {s.text}
              </p>
            </section>
          ))}
          {sections.length === 0 && (
            <p className="text-center text-2xl text-white/60">السكريبت فاضي</p>
          )}
        </div>
      </div>

      {/* Countdown */}
      <AnimatePresence>
        {countdown !== null && countdown > 0 && (
          <motion.div
            key={countdown}
            initial={{ opacity: 0, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none fixed inset-0 z-30 grid place-items-center"
          >
            <span className="font-display text-[9rem] font-bold text-gradient">{countdown}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <motion.header
        animate={{ opacity: showChrome ? 1 : 0, y: showChrome ? 0 : -16 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'fixed inset-x-0 top-0 z-20 flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]',
          !showChrome && 'pointer-events-none',
        )}
      >
        <button
          type="button"
          onClick={exit}
          aria-label="خروج"
          className="grid size-11 place-items-center rounded-full bg-white/10 backdrop-blur-xl transition-colors hover:bg-white/20"
        >
          <X size={20} />
        </button>
        <p className="line-clamp-1 flex-1 text-sm font-medium text-white/70">{idea.title}</p>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70 backdrop-blur-xl">
          باقي <span className="num">{formatDuration(remaining)}</span>
        </span>
      </motion.header>

      {/* Controls */}
      <motion.div
        animate={{ opacity: showChrome ? 1 : 0, y: showChrome ? 0 : 20 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          !showChrome && 'pointer-events-none',
        )}
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3 rounded-[26px] border border-white/10 bg-white/[0.07] p-3 backdrop-blur-2xl">
          <CtlButton label="من البداية" onClick={restart}>
            <RotateCcw size={19} />
          </CtlButton>
          <div className="flex items-center gap-1 rounded-2xl bg-white/5 p-1">
            <CtlButton
              label="تصغير الخط"
              onClick={() => setPrefs((p) => ({ ...p, size: Math.max(20, p.size - 4) }))}
            >
              <Minus size={18} />
            </CtlButton>
            <span className="w-10 text-center text-sm font-semibold">
              <span className="num">{prefs.size}</span>
            </span>
            <CtlButton
              label="تكبير الخط"
              onClick={() => setPrefs((p) => ({ ...p, size: Math.min(88, p.size + 4) }))}
            >
              <Plus size={18} />
            </CtlButton>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'إيقاف' : 'تشغيل'}
            className="grid size-16 place-items-center rounded-full bg-accent-gradient-strong text-white shadow-[0_12px_30px_-10px_var(--accent)] transition-transform active:scale-90"
          >
            {playing || countdown !== null ? (
              <Pause size={28} fill="currentColor" />
            ) : (
              <Play size={28} fill="currentColor" className="-me-1" />
            )}
          </button>
          <label className="flex items-center gap-2.5 rounded-2xl bg-white/5 px-3 py-2">
            <span className="text-xs text-white/60">السرعة</span>
            <input
              type="range"
              min={1}
              max={10}
              value={prefs.speed}
              onChange={(e) => setPrefs((p) => ({ ...p, speed: Number(e.target.value) }))}
              aria-label="سرعة التمرير"
              className="w-24 accent-[var(--accent)]"
            />
            <span className="w-4 text-sm font-semibold">
              <span className="num">{prefs.speed}</span>
            </span>
          </label>
          <CtlButton
            label="عكس الصورة للمرآة"
            active={prefs.mirror}
            onClick={() => setPrefs((p) => ({ ...p, mirror: !p.mirror }))}
          >
            <FlipHorizontal2 size={19} />
          </CtlButton>
        </div>
        <div
          className="mx-auto mt-3 h-1 max-w-2xl overflow-hidden rounded-full bg-white/10"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-accent-gradient"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </motion.div>
    </div>
  );
}

function CtlButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid size-11 place-items-center rounded-xl transition-colors active:scale-90',
        active ? 'bg-white text-black' : 'text-white/85 hover:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}
