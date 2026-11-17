// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { FlipHorizontal2, Mic, Minus, Pause, Play, Plus, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useIdea, useSettings } from '@/hooks/data';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/script';
import {
  countBlanks,
  DEFAULT_DIALECT,
  describeVoiceError,
  dialectLabel,
  DIALECTS,
  followSpeech,
  isIosStandalone,
  isSpace,
  normalizeWord,
  parseDialect,
  resyncPosition,
  tokenize,
  type DialectCode,
  type VoiceIssue,
} from '@/lib/voiceFollow';
import { PrompterDialog, type Dialog } from './PrompterDialog';

/* Teleprompter: the script scrolls past a reading line while filming, either at a
   steady speed or following the reader's voice (speech recognition). Keeps the
   screen awake, mirrors for prompter glass, and remembers the setup. */

const PREFS_KEY = 'kawalees:prompter';
const LANG_KEY = 'kawalees:prompter-lang';
const PRIVACY_KEY = 'kawalees:prompter-voice-privacy';

interface Prefs {
  size: number;
  speed: number;
  mirror: boolean;
  voice: boolean;
}
const DEFAULTS: Prefs = { size: 40, speed: 4, mirror: false, voice: false };

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts until the screen closes */
  }
}

/** Speed steps 1–10 → pixels per second. */
const pxPerSecond = (speed: number) => 14 + speed * 16;

interface WakeLock {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
}

// The Web Speech API, as far as voice-follow uses it (Chrome and Safari ship it prefixed).
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  // Speech recognition relies on the browser's own service, which the downloaded apps don't have.
  if (__NATIVE__) return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** An iPhone or iPad running the installed app, where voice-follow is unreliable. */
function iosInstalledRisk(): boolean {
  if (__NATIVE__) return false;
  try {
    return isIosStandalone({
      ua: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: (navigator as Navigator & { standalone?: boolean }).standalone,
      displayStandalone: window.matchMedia('(display-mode: standalone)').matches,
    });
  } catch {
    return false;
  }
}

const UNSUPPORTED: VoiceIssue = {
  kind: 'service',
  title: 'وضع الصوت غير متاح هنا',
  text: __NATIVE__
    ? 'متابعة الصوت تعمل في نسخة المتصفح من التطبيق، لأنها تعتمد على خدمة التعرّف على الكلام في المتصفح.'
    : 'متابعة الصوت تعمل في كروم وسفاري، وهذا المتصفح لا يوفّر خدمة التعرّف على الكلام.',
  fatal: true,
};

/** Scroll position that puts a word on the reading line. */
function wordTarget(el: HTMLElement, word: HTMLElement): number {
  const top = word.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
  return top + word.offsetHeight / 2 - el.clientHeight * 0.36;
}

export default function PrompterPage() {
  const { id } = useParams();
  const idea = useIdea(id);
  const settings = useSettings();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [lang, setLang] = useState<DialectCode>(() => parseDialect(readStore(LANG_KEY)));
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [remainingPx, setRemainingPx] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const exact = useRef(0);
  const wake = useRef<WakeLock | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const noticeTimer = useRef<number | undefined>(undefined);
  // What the reader has already agreed to on this screen.
  const blanksOk = useRef(false);
  const iosOk = useRef(false);
  const privacySeen = useRef(false);
  // Voice-follow: how many script words have been said so far.
  const [said, setSaid] = useState(0);
  const saidRef = useRef(0);

  // The script as sections of tokens; every word gets a running index for voice-follow.
  const script = useMemo(() => {
    const words: string[] = [];
    const sections = idea
      ? [
          { label: 'الخطّاف', text: idea.hook },
          { label: 'المحتوى', text: idea.body },
          { label: 'الدعوة للتفاعل', text: idea.cta },
        ]
          .filter((s) => s.text.trim())
          .map((s) => ({
            label: s.label,
            tokens: tokenize(s.text).map((t) =>
              isSpace(t) ? { t, i: -1 } : { t, i: words.push(normalizeWord(t)) - 1 },
            ),
          }))
      : [];
    return { sections, words };
  }, [idea]);

  const blanks = useMemo(() => (idea ? countBlanks(idea.hook, idea.body, idea.cta) : 0), [idea]);

  const setSaidAt = useCallback((n: number) => {
    saidRef.current = n;
    setSaid(n);
  }, []);

  /** A short message that fades by itself (it never stays on screen for good). */
  const notify = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

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

  const listening = playing && prefs.voice && dialog === null;

  // Steady scroll loop.
  useEffect(() => {
    if (!playing || prefs.voice) return;
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
  }, [playing, prefs.speed, prefs.voice]);

  // Voice-follow: listen, and move the reading position to the words just said.
  useEffect(() => {
    if (!listening) return;
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    let alive = true;
    let silent = 0;
    let rec: Recognition | null = null;
    // Voice mode cannot go on: back to the steady speed, with the reason and what to do.
    const fail = (issue: VoiceIssue) => {
      alive = false;
      setPlaying(false);
      setPrefs((p) => ({ ...p, voice: false }));
      setDialog({ kind: 'problem', issue, resume: true });
    };
    const begin = () => {
      const r = new Ctor();
      rec = r;
      r.lang = lang;
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        silent = 0;
        let heard = '';
        for (let i = 0; i < e.results.length; i++)
          heard += ' ' + (e.results[i]?.[0]?.transcript ?? '');
        const next = followSpeech(script.words, saidRef.current, heard.trim().split(/\s+/u));
        if (next === saidRef.current) return;
        setSaidAt(next);
        if (next >= script.words.length) setPlaying(false);
      };
      r.onerror = (e) => {
        const issue = describeVoiceError(e.error);
        if (issue.kind === 'ignore') return;
        if (issue.kind === 'silence') {
          // Silence is normal between takes: say so once, and keep listening.
          if (++silent === 2) notify(issue.text);
          return;
        }
        if (issue.kind === 'language') {
          if (lang !== DEFAULT_DIALECT) {
            // This browser lacks that dialect: carry on with the default one.
            alive = false;
            writeStore(LANG_KEY, DEFAULT_DIALECT);
            setLang(DEFAULT_DIALECT);
            notify(`لهجة ${dialectLabel(lang)} غير مدعومة في هذا المتصفح، عدنا إلى السعودية`);
            return;
          }
          fail({
            ...issue,
            title: 'العربية غير مدعومة في التعرّف على الكلام',
            text: 'هذا المتصفح لا يدعم التعرّف على الكلام بالعربية. تستمر الشاشة بالسرعة الثابتة.',
            fatal: true,
          });
          return;
        }
        fail(issue);
      };
      // Browsers end a session after a pause; carry on listening until stopped.
      r.onend = () => {
        if (!alive) return;
        try {
          begin();
        } catch {
          fail(describeVoiceError(''));
        }
      };
      r.start();
    };
    try {
      begin();
    } catch {
      queueMicrotask(() => fail(describeVoiceError('')));
    }
    return () => {
      alive = false;
      const r = rec as Recognition | null;
      if (!r) return;
      r.onend = null;
      r.onresult = null;
      r.onerror = null;
      try {
        r.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [listening, script, lang, setSaidAt, notify]);

  // Voice-follow scrolling: glide the last word said onto the reading line.
  useEffect(() => {
    if (!listening) return;
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const word = el.querySelector<HTMLElement>(`[data-w="${Math.max(0, saidRef.current - 1)}"]`);
      if (word) {
        const d = wordTarget(el, word) - el.scrollTop;
        if (Math.abs(d) > 0.5) el.scrollTop += d * 0.08;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [listening]);

  // Keep the screen on while this screen is open. The system lets go of the lock whenever
  // the page is hidden, so ask again as soon as it is visible.
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<WakeLock> };
    };
    const api = nav.wakeLock;
    if (!api) return;
    let dead = false;
    let asking = false;
    const acquire = () => {
      if (dead || asking || wake.current || document.visibilityState !== 'visible') return;
      asking = true;
      api
        .request('screen')
        .then((lock) => {
          if (dead) {
            void lock.release().catch(() => {});
            return;
          }
          wake.current = lock;
          lock.addEventListener?.('release', () => {
            if (wake.current === lock) wake.current = null;
          });
        })
        .catch(() => {})
        .finally(() => {
          asking = false;
        });
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      dead = true;
      document.removeEventListener('visibilitychange', acquire);
      void wake.current?.release().catch(() => {});
      wake.current = null;
    };
  }, []);

  // Controls fade away while playing; any touch brings them back.
  const poke = useCallback(() => {
    setChrome(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 2600);
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

  /**
   * Start filming ('start') or switch voice mode on ('enable'), after the checks that come
   * first: unfilled blanks, a browser without speech recognition, the installed iPhone app,
   * and the one-time note that voice mode needs the internet.
   */
  const act = useCallback(
    (action: 'enable' | 'start') => {
      if (action === 'start' && blanks > 0 && !blanksOk.current) {
        setDialog({ kind: 'blanks', count: blanks });
        return;
      }
      if (action === 'enable' || prefs.voice) {
        if (!recognitionCtor()) {
          setPrefs((p) => ({ ...p, voice: false }));
          setDialog({ kind: 'problem', issue: UNSUPPORTED, resume: action === 'start' });
          return;
        }
        if (iosInstalledRisk() && !iosOk.current) {
          setDialog({ kind: 'ios', action });
          return;
        }
        if (!privacySeen.current && readStore(PRIVACY_KEY) !== '1') {
          setDialog({ kind: 'privacy', action });
          return;
        }
      }
      if (action === 'enable') {
        setPlaying(false);
        setCountdown(null);
        setPrefs((p) => ({ ...p, voice: true }));
      } else setCountdown(3);
    },
    [blanks, prefs.voice],
  );

  const toggle = useCallback(() => {
    if (countdown !== null) {
      setCountdown(null);
      return;
    }
    if (playing) {
      setPlaying(false);
      setChrome(true);
    } else act('start');
  }, [countdown, playing, act]);

  const toggleVoice = () => {
    if (prefs.voice) {
      setPlaying(false);
      setCountdown(null);
      setPrefs((p) => ({ ...p, voice: false }));
    } else act('enable');
  };

  const chooseLang = (code: DialectCode) => {
    setLang(code);
    writeStore(LANG_KEY, code);
  };

  // What each dialog button does.
  const onContinueVoice = () => {
    if (!dialog || (dialog.kind !== 'privacy' && dialog.kind !== 'ios')) return;
    if (dialog.kind === 'ios') iosOk.current = true;
    else {
      privacySeen.current = true;
      writeStore(PRIVACY_KEY, '1');
    }
    setDialog(null);
    act(dialog.action);
  };
  const onSteady = () => {
    const d = dialog;
    setDialog(null);
    setPrefs((p) => ({ ...p, voice: false }));
    const resume =
      d?.kind === 'problem'
        ? d.resume
        : (d?.kind === 'privacy' || d?.kind === 'ios') && d.action === 'start';
    if (resume) setCountdown(3);
  };
  const onRetry = () => {
    setDialog(null);
    act('enable');
  };
  const onFilmAnyway = () => {
    blanksOk.current = true;
    setDialog(null);
    act('start');
  };
  const onEdit = () => {
    setDialog(null);
    exit();
  };

  const restart = () => {
    setPlaying(false);
    setSaidAt(0);
    scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (dialog) return;
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
  }, [toggle, exit, dialog]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? el.scrollTop / max : 0);
    setRemainingPx(Math.max(0, max - el.scrollTop));
  }, []);

  // In voice mode a touched word is where the reader is: the tracker carries on from there.
  // Anywhere else a touch starts or pauses, as before.
  const onScrollerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scroller.current;
    const word = prefs.voice ? (e.target as HTMLElement).closest<HTMLElement>('[data-w]') : null;
    if (!el || !word) {
      toggle();
      return;
    }
    const index = Number(word.dataset.w);
    setSaidAt(resyncPosition(index, script.words.length));
    if (!listening) el.scrollTo({ top: wordTarget(el, word), behavior: 'smooth' });
    else poke();
  };

  // Measure once the script has rendered (and again if the text size changes).
  useEffect(() => {
    const raf = requestAnimationFrame(onScroll);
    return () => cancelAnimationFrame(raf);
  }, [onScroll, prefs.size, idea]);

  useEffect(() => {
    if (idea === null) exit();
  }, [idea, exit]);

  if (!idea) return <div className="fixed inset-0 bg-[#050507]" />;

  const { sections, words } = script;
  const remaining = prefs.voice
    ? (Math.max(0, words.length - said) / Math.max(1, settings.wordsPerMinute)) * 60
    : remainingPx / pxPerSecond(prefs.speed);

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
        onClick={onScrollerClick}
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
                {s.tokens.map((tok, k) =>
                  tok.i < 0 ? (
                    tok.t
                  ) : (
                    <span
                      key={k}
                      data-w={tok.i}
                      data-said={prefs.voice && tok.i < said ? '' : undefined}
                      className={cn(
                        'transition-colors duration-300',
                        tok.t.includes('___') && 'text-[var(--warn)]',
                        prefs.voice && tok.i < said && 'text-white/35',
                      )}
                    >
                      {tok.t}
                    </span>
                  ),
                )}
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

      {/* Short messages: they fade by themselves, whatever the controls are doing */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(4.75rem,calc(env(safe-area-inset-top)+3.75rem))] z-30 flex justify-center px-4"
      >
        {notice && (
          <p className="max-w-md rounded-2xl bg-white/15 px-4 py-2 text-center text-sm text-white backdrop-blur-xl">
            {notice}
          </p>
        )}
      </div>

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
          title="خروج"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 backdrop-blur-xl transition-colors hover:bg-white/20"
        >
          <X size={20} />
        </button>
        <p className="line-clamp-1 flex-1 text-sm font-medium text-white/70">{idea.title}</p>
        {listening && (
          <span
            role="status"
            className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-xl"
          >
            <span className="size-2 animate-pulse rounded-full bg-[var(--accent)]" />
            الاستماع شغال
          </span>
        )}
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
        {prefs.voice && (
          <p className="mx-auto mb-3 w-fit rounded-full bg-white/10 px-4 py-1.5 text-xs text-white/75 backdrop-blur-xl">
            المس أي كلمة لإعادة المزامنة
          </p>
        )}
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3 rounded-[26px] border border-white/10 bg-white/[0.07] p-3 backdrop-blur-2xl">
          <CtlButton label="من البداية" text="من البداية" onClick={restart}>
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
            aria-label={playing || countdown !== null ? 'إيقاف' : 'تشغيل'}
            title={playing || countdown !== null ? 'إيقاف' : 'تشغيل'}
            className="grid size-16 place-items-center rounded-full bg-accent-gradient-strong text-white shadow-[0_12px_30px_-10px_var(--accent)] transition-transform active:scale-90"
          >
            {playing || countdown !== null ? (
              <Pause size={28} fill="currentColor" />
            ) : (
              <Play size={28} fill="currentColor" className="-me-1" />
            )}
          </button>
          <label
            className={cn(
              'flex min-h-11 items-center gap-2.5 rounded-2xl bg-white/5 px-3',
              prefs.voice && 'hidden',
            )}
          >
            <span className="text-xs text-white/60">السرعة</span>
            <input
              type="range"
              min={1}
              max={10}
              value={prefs.speed}
              onChange={(e) => setPrefs((p) => ({ ...p, speed: Number(e.target.value) }))}
              aria-label="سرعة التمرير"
              className={cn(
                'h-11 w-36 cursor-pointer appearance-none bg-transparent accent-[var(--accent)]',
                '[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/20',
                '[&::-webkit-slider-thumb]:-mt-2.5 [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md',
                '[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/20',
                '[&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white',
              )}
            />
            <span className="w-5 text-center text-sm font-semibold">
              <span className="num">{prefs.speed}</span>
            </span>
          </label>
          <CtlButton
            label="يتبع الصوت"
            text="يتبع الصوت"
            active={prefs.voice}
            onClick={toggleVoice}
          >
            <Mic size={19} />
          </CtlButton>
          {prefs.voice && (
            <label className="flex min-h-11 items-center gap-2 rounded-2xl bg-white/5 ps-3">
              <span className="text-xs text-white/60">اللهجة</span>
              <select
                value={lang}
                onChange={(e) => chooseLang(parseDialect(e.target.value))}
                aria-label="لهجة التعرّف على الكلام"
                className="min-h-11 rounded-2xl bg-transparent pe-3 ps-1 text-sm font-semibold text-white outline-none"
              >
                {DIALECTS.map((d) => (
                  <option key={d.code} value={d.code} className="bg-[#14141a] text-white">
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <CtlButton
            label="عكس الصورة للمرآة"
            text="مرآة"
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

      {dialog && (
        <PrompterDialog
          dialog={dialog}
          onContinueVoice={onContinueVoice}
          onSteady={onSteady}
          onRetry={onRetry}
          onEdit={onEdit}
          onFilmAnyway={onFilmAnyway}
        />
      )}
    </div>
  );
}

function CtlButton({
  label,
  text,
  onClick,
  children,
  active,
}: {
  label: string;
  /** A visible caption under the icon, for buttons that are only an icon otherwise. */
  text?: string;
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
        'flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-xl transition-colors active:scale-90',
        text ? 'px-2.5 py-1.5' : 'size-11',
        active ? 'bg-white text-black' : 'text-white/85 hover:bg-white/10',
      )}
    >
      {children}
      {text && <span className="text-xs leading-none font-medium">{text}</span>}
    </button>
  );
}
