// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { X } from 'lucide-react';
import { animate, AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useIdea, useSettings } from '@/hooks/data';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { formatDuration } from '@/lib/script';
import {
  countBlanks,
  DEFAULT_DIALECT,
  describeVoiceError,
  dialectLabel,
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
import { PrompterControls } from './PrompterControls';
import { PrompterDialog, type Dialog } from './PrompterDialog';
import { Countdown, FinishCard, SectionChips } from './PrompterOverlays';
import {
  DEFAULT_LEADING_LEVEL,
  LEADING_KEY,
  LEADING_LEVELS,
  readLeadingLevel,
  readSizeLevel,
  SIZE_KEY,
  SIZE_LEVELS,
} from './readingPrefs';
import { ReadingScroller } from './scrollEngine';

/* Teleprompter: the script moves past a reading band while filming, either at a steady speed
   or following the reader's voice (speech recognition). The scrolling itself lives in
   scrollEngine.ts (one frame loop, fractional offset, eased); this file is the screen around
   it. Keeps the screen awake, mirrors for prompter glass, and remembers the setup. */

const PREFS_KEY = 'kawalees:prompter';
const LANG_KEY = 'kawalees:prompter-lang';
const PRIVACY_KEY = 'kawalees:prompter-voice-privacy';

interface Prefs {
  speed: number;
  mirror: boolean;
  voice: boolean;
}
const DEFAULTS: Prefs = { speed: 4, mirror: false, voice: false };

function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    return {
      speed: Math.min(10, Math.max(1, Number(saved.speed) || DEFAULTS.speed)),
      mirror: saved.mirror === true,
      voice: saved.voice === true,
    };
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

/** Where the reading band sits, as a share of the screen height (from the top). */
const READ_AT = 0.36;
/** The controls fade this long after the last touch while playing. */
const HIDE_AFTER_MS = 3000;
/** Each countdown number stays this long. */
const COUNT_STEP_MS = 750;
/** Easing used across the screen: quick start, long soft landing. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* Text fades into the top and the bottom of the screen with a mask, not with painted
   gradients: the line being read is fully lit, what was read dims away upwards, what comes
   next is a little softer, and both edges dissolve. */
const READING_MASK =
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.1) 8%, rgba(0,0,0,.32) 19%, rgba(0,0,0,.8) 30%, #000 34.5%, #000 40%, rgba(0,0,0,.82) 49%, rgba(0,0,0,.56) 64%, rgba(0,0,0,.3) 82%, rgba(0,0,0,.08) 95%, transparent 100%)';

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

const SECTION_DEFS = [
  { key: 'hook', label: 'الخطّاف' },
  { key: 'body', label: 'المحتوى' },
  { key: 'cta', label: 'الدعوة' },
] as const;

/** Where a word sits inside the moving content (layout pixels, unaffected by the mirror). */
function wordBox(content: HTMLElement | null, index: number) {
  const w = content?.querySelector<HTMLElement>(`[data-w="${index}"]`);
  return w ? { x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight } : null;
}

interface Layout {
  min: number;
  max: number;
  readY: number;
  vh: number;
  tops: number[];
  firstY: number[];
}

export default function PrompterPage() {
  const { id } = useParams();
  const idea = useIdea(id);
  const settings = useSettings();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [sizeLevel, setSizeLevel] = useState(() => readSizeLevel(readStore, PREFS_KEY));
  const [leadingLevel, setLeadingLevel] = useState(() => readLeadingLevel(readStore));
  const [lang, setLang] = useState<DialectCode>(() => parseDialect(readStore(LANG_KEY)));
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [playedSec, setPlayedSec] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const [revealed, setRevealed] = useState(1);
  const [layoutV, setLayoutV] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const ember = useRef<HTMLDivElement>(null);
  const wake = useRef<WakeLock | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const noticeTimer = useRef<number | undefined>(undefined);
  const finishTimer = useRef<number | undefined>(undefined);
  // What the reader has already agreed to on this screen.
  const blanksOk = useRef(false);
  const iosOk = useRef(false);
  const privacySeen = useRef(false);
  // Voice-follow: how many script words have been said so far.
  const [said, setSaid] = useState(0);
  const saidRef = useRef(0);
  // Frame-level bookkeeping kept out of React state (it changes every frame).
  const lay = useRef<Layout>({ min: 0, max: 0, readY: 0, vh: 0, tops: [], firstY: [] });
  const speedRef = useRef(prefs.speed);
  const activeRef = useRef(0);
  const revealedRef = useRef(1);
  const remainingRef = useRef(-1);
  const finishedRef = useRef(false);
  const playStart = useRef<number | null>(null);
  const playedMs = useRef(0);
  const emberShown = useRef(false);
  const drag = useRef<{ id: number; y0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const [engine] = useState(() => new ReadingScroller(Math.min(3, window.devicePixelRatio || 1)));
  useEffect(() => () => engine.destroy(), [engine]);

  // The script as sections of tokens; every word gets a running index for voice-follow.
  const script = useMemo(() => {
    const words: string[] = [];
    const sections = idea
      ? SECTION_DEFS.map((d) => ({ ...d, text: idea[d.key] }))
          .filter((s) => s.text.trim())
          .map((s) => {
            const first = words.length;
            return {
              key: s.key,
              label: s.label,
              first,
              tokens: tokenize(s.text).map((t) =>
                isSpace(t) ? { t, i: -1 } : { t, i: words.push(normalizeWord(t)) - 1 },
              ),
            };
          })
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

  useEffect(
    () => () => {
      window.clearTimeout(noticeTimer.current);
      window.clearTimeout(finishTimer.current);
      window.clearTimeout(hideTimer.current);
    },
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);
  useEffect(() => writeStore(SIZE_KEY, String(sizeLevel)), [sizeLevel]);
  useEffect(() => writeStore(LEADING_KEY, String(leadingLevel)), [leadingLevel]);

  const exit = useCallback(
    () => navigate(id ? `/idea/${id}` : '/ideas', { replace: true }),
    [navigate, id],
  );

  const listening = playing && prefs.voice && dialog === null;
  const ready = idea != null;

  // How long the reader actually spent reading (shown on the closing card).
  const bankPlay = useCallback(() => {
    if (playStart.current !== null) playedMs.current += performance.now() - playStart.current;
    playStart.current = null;
  }, []);
  useEffect(() => {
    if (playing) playStart.current = performance.now();
    else bankPlay();
  }, [playing, bankPlay]);

  const finish = useCallback(() => {
    bankPlay();
    setPlayedSec(Math.round(playedMs.current / 1000));
    setPlaying(false);
    setCountdown(null);
    finishedRef.current = true;
    setFinished(true);
    haptics.success();
  }, [bankPlay]);

  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);

  /** Everything that follows the offset: progress, time left, current section, label reveal. */
  const syncFrame = useCallback((pos: number) => {
    const L = lay.current;
    if (bar.current)
      bar.current.style.transform = `scaleX(${L.max > L.min ? (pos - L.min) / (L.max - L.min) : 0})`;
    const rem = Math.round(Math.max(0, L.max - pos) / pxPerSecond(speedRef.current));
    if (rem !== remainingRef.current) {
      remainingRef.current = rem;
      setRemainingSec(rem);
    }
    let active = 0;
    L.firstY.forEach((y, i) => {
      if (y <= pos + L.readY + 8) active = i;
    });
    if (active !== activeRef.current) {
      activeRef.current = active;
      setActiveSection(active);
    }
    let seen = 1;
    L.tops.forEach((y, i) => {
      if (y - pos < L.vh * 0.92) seen = i + 1;
    });
    if (seen > revealedRef.current) {
      revealedRef.current = seen;
      setRevealed(seen);
    }
    if (finishedRef.current && pos < L.max - 60) {
      finishedRef.current = false;
      setFinished(false);
    }
  }, []);

  useLayoutEffect(() => {
    engine.bind({
      apply: (pos) => {
        const el = content.current;
        if (el) el.style.transform = `translate3d(0, ${-pos}px, 0)`;
      },
      onFrame: syncFrame,
      onEnd: finish,
    });
  }, [engine, syncFrame, finish]);

  // Measure the content: how far it can go, where each section starts. Redone when anything resizes.
  const measure = useCallback(() => {
    const vp = viewport.current;
    const c = content.current;
    if (!vp || !c) return;
    const L = lay.current;
    L.vh = vp.clientHeight;
    L.readY = L.vh * READ_AT;
    const contentMax = Math.max(0, c.offsetHeight - L.vh);
    L.tops = [...c.querySelectorAll<HTMLElement>('[data-section]')].map((el) => el.offsetTop);
    L.firstY = script.sections.map((s) => {
      const box = wordBox(c, s.first);
      return box ? box.y + box.h / 2 : (L.tops[0] ?? 0);
    });
    // The script starts with its first line on the reading band (above it sits the section name).
    const first = wordBox(c, 0);
    L.min = first ? Math.max(0, first.y + first.h / 2 - L.readY) : 0;
    // ...and ends with the last line on the band: that is when the whole text has been read.
    const lastBox = script.words.length > 0 ? wordBox(c, script.words.length - 1) : null;
    L.max = lastBox
      ? Math.min(contentMax, Math.max(L.min, lastBox.y + lastBox.h / 2 - L.readY))
      : contentMax;
    engine.setBounds(L.min, L.max);
    syncFrame(engine.pos);
    setLayoutV((v) => v + 1);
  }, [engine, script, syncFrame]);

  useLayoutEffect(() => {
    if (!ready) return;
    measure();
    const vp = viewport.current;
    const c = content.current;
    if (!vp || !c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(c);
    return () => ro.disconnect();
  }, [ready, measure]);

  // Steady scroll: the engine eases up to the speed, and back down to a stop.
  useEffect(() => {
    speedRef.current = prefs.speed;
    engine.setSpeed(playing && !prefs.voice ? pxPerSecond(prefs.speed) : 0);
    syncFrame(engine.pos);
  }, [engine, playing, prefs.speed, prefs.voice, syncFrame]);

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
        if (next >= script.words.length) {
          // The last word was said: let the screen settle on it, then close.
          setPlaying(false);
          window.clearTimeout(finishTimer.current);
          finishTimer.current = window.setTimeout(finish, 650);
        }
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
  }, [listening, script, lang, setSaidAt, notify, finish]);

  // Voice mode: the word about to be read sits on the reading band. While listening the engine
  // keeps chasing it with a soft spring; otherwise (a touched word, a section jump) it glides once.
  useEffect(() => {
    if (!ready) return;
    if (!prefs.voice) {
      engine.follow(null);
      return;
    }
    const n = script.words.length;
    const box = n > 0 ? wordBox(content.current, Math.min(said, n - 1)) : null;
    if (!box) return;
    const y = box.y + box.h / 2 - lay.current.readY;
    if (listening) engine.follow(y);
    else engine.glideTo(y);
  }, [ready, engine, prefs.voice, listening, said, script, layoutV, sizeLevel, leadingLevel]);

  // The ember behind the word being read moves with a light spring (transform and opacity only).
  useEffect(() => {
    const el = ember.current;
    if (!el || !ready) return;
    const n = script.words.length;
    const box = prefs.voice && said < n ? wordBox(content.current, said) : null;
    if (!box) {
      emberShown.current = false;
      animate(el, { opacity: 0 }, { duration: reduce ? 0 : 0.25 });
      return;
    }
    const pad = (SIZE_LEVELS[sizeLevel] ?? 40) * 0.3;
    const target = {
      x: box.x - pad,
      y: box.y - pad * 0.7,
      scaleX: (box.w + pad * 2) / 100,
      scaleY: (box.h + pad * 1.4) / 100,
      opacity: 1,
    };
    const first = !emberShown.current;
    emberShown.current = true;
    animate(
      el,
      target,
      first || reduce
        ? { duration: 0 }
        : { type: 'spring', stiffness: 230, damping: 26, mass: 0.9 },
    );
  }, [ready, prefs.voice, said, layoutV, sizeLevel, leadingLevel, script, reduce]);

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
    hideTimer.current = window.setTimeout(() => setChrome(false), HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    haptics.tap();
    const t = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        setPlaying(true);
        poke();
      } else setCountdown(countdown - 1);
    }, COUNT_STEP_MS);
    return () => window.clearTimeout(t);
  }, [countdown, poke]);

  const restart = useCallback(() => {
    window.clearTimeout(finishTimer.current);
    setPlaying(false);
    setCountdown(null);
    setFinished(false);
    finishedRef.current = false;
    playedMs.current = 0;
    setSaidAt(0);
    engine.glideTo(lay.current.min);
    setChrome(true);
  }, [engine, setSaidAt]);

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
    if (finished) {
      restart();
      return;
    }
    if (countdown !== null) {
      setCountdown(null);
      return;
    }
    if (playing) {
      setPlaying(false);
      setChrome(true);
    } else act('start');
  }, [finished, restart, countdown, playing, act]);

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

  const changeSize = useCallback((delta: 1 | -1) => {
    setSizeLevel((l) => Math.min(SIZE_LEVELS.length - 1, Math.max(0, l + delta)));
  }, []);

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

  useEffect(() => {
    if (dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape') exit();
      else if (e.key === 'ArrowUp') setPrefs((p) => ({ ...p, speed: Math.min(10, p.speed + 1) }));
      else if (e.key === 'ArrowDown') setPrefs((p) => ({ ...p, speed: Math.max(1, p.speed - 1) }));
      else if (e.key === '+' || e.key === '=') changeSize(1);
      else if (e.key === '-') changeSize(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, exit, dialog, changeSize]);

  /** Jump to a section: its first line glides onto the reading band. */
  const jumpTo = (index: number) => {
    const s = script.sections[index];
    const box = s ? wordBox(content.current, s.first) : null;
    if (!s || !box) return;
    poke();
    setFinished(false);
    finishedRef.current = false;
    if (prefs.voice) setSaidAt(s.first);
    if (!listening) engine.glideTo(box.y + box.h / 2 - lay.current.readY);
  };

  // A mouse wheel or trackpad nudges the script; the page behind never scrolls.
  useEffect(() => {
    const el = viewport.current;
    if (!el || !ready) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      engine.wheel(e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [engine, ready]);

  // Dragging the script with a finger or a mouse; letting go keeps a little momentum.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (playing) poke();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, y0: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.abs(dy) < 8) return;
      d.moved = true;
      engine.dragStart();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer is already gone */
      }
    }
    engine.dragMove(dy, e.timeStamp);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    engine.dragEnd(e.timeStamp);
    // The click that follows a drag is not a tap.
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 60);
  };

  // In voice mode a touched word is where the reader is: the tracker carries on from there.
  // Anywhere else a touch starts or pauses, as before.
  const onViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) return;
    const word = prefs.voice ? (e.target as HTMLElement).closest<HTMLElement>('[data-w]') : null;
    if (!word) {
      if (!finished) toggle();
      return;
    }
    const index = Number(word.dataset.w);
    setFinished(false);
    finishedRef.current = false;
    setSaidAt(resyncPosition(index, script.words.length));
    if (listening) poke();
  };

  useEffect(() => {
    if (idea === null) exit();
  }, [idea, exit]);

  if (!idea) return <div className="fixed inset-0 bg-[#050507]" />;

  const { sections, words } = script;
  const remaining = prefs.voice
    ? (Math.max(0, words.length - said) / Math.max(1, settings.wordsPerMinute)) * 60
    : remainingSec;

  const showChrome = chrome || !playing || dialog !== null;
  const fontSize = SIZE_LEVELS[sizeLevel] ?? 40;
  const leading =
    LEADING_LEVELS[leadingLevel]?.value ?? LEADING_LEVELS[DEFAULT_LEADING_LEVEL].value;
  const timeText = formatDuration(remaining);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-[#050507] text-white"
      onPointerMove={playing ? poke : undefined}
    >
      {/* The reading band: a soft lit strip with its two focus marks, drawn behind the text */}
      <div
        className="pointer-events-none absolute inset-x-0 z-0 -translate-y-1/2"
        style={{ top: `${READ_AT * 100}%`, height: fontSize * leading + 14 }}
        aria-hidden
      >
        <div
          className="absolute inset-x-6 inset-y-0 border-y border-white/[0.07] bg-white/[0.045]"
          style={{
            maskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
          }}
        />
        <FocusMark side="start" calm={!!reduce} />
        <FocusMark side="end" calm={!!reduce} />
      </div>

      {/* The script. Moves by a fractional transform; the mask dims what was read, softens what is
          next and dissolves both ends of the screen. */}
      <div
        ref={viewport}
        onClick={onViewportClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="absolute inset-0 z-10 touch-none overflow-hidden select-none"
        style={{ maskImage: READING_MASK, WebkitMaskImage: READING_MASK }}
      >
        <div className="h-full" style={{ transform: prefs.mirror ? 'scaleX(-1)' : undefined }}>
          <div ref={content} data-reading-content className="relative will-change-transform">
            <div className="relative z-10 mx-auto max-w-4xl px-7 pt-[36dvh] pb-[64dvh] md:px-12">
              {/* Positioned from measurements, so physical left/top are what is wanted here. */}
              <div
                ref={ember}
                aria-hidden
                className="pointer-events-none absolute top-0 left-0 -z-10 size-[100px] origin-top-left opacity-0"
                style={{
                  background:
                    'radial-gradient(closest-side, color-mix(in oklab, var(--accent) 52%, transparent) 0%, color-mix(in oklab, var(--accent-2) 24%, transparent) 52%, transparent 100%)',
                }}
              />
              {sections.map((s, n) => (
                <section
                  key={s.key}
                  data-section={s.key}
                  className="mb-[1.2em]"
                  style={{ fontSize }}
                >
                  <motion.div
                    initial={false}
                    animate={{
                      opacity: revealed > n ? 1 : 0,
                      y: revealed > n || reduce ? 0 : 10,
                    }}
                    transition={{ duration: reduce ? 0 : 0.55, ease: EASE_OUT }}
                    className="mb-3 flex items-center gap-2.5 font-sans"
                  >
                    <span className="size-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
                    <span className="text-sm font-semibold tracking-wide text-[var(--accent-ink-d)]">
                      {s.label}
                    </span>
                    <span
                      className="h-px max-w-24 flex-1 bg-gradient-to-l from-white/20 to-transparent"
                      aria-hidden
                    />
                  </motion.div>
                  <p
                    className="font-display font-semibold whitespace-pre-wrap text-white/95"
                    style={{ lineHeight: leading }}
                  >
                    {s.tokens.map((tok, k) =>
                      tok.i < 0 ? (
                        tok.t
                      ) : (
                        <span
                          key={k}
                          data-w={tok.i}
                          data-said={prefs.voice && tok.i < said ? '' : undefined}
                          data-now={prefs.voice && tok.i === said ? '' : undefined}
                          className={cn(
                            'transition-[color,text-shadow] duration-500 ease-out',
                            tok.t.includes('___') && 'text-[var(--warn)]',
                            prefs.voice && tok.i < said && 'text-white/35',
                            prefs.voice &&
                              tok.i === said &&
                              'text-[color-mix(in_oklab,var(--accent-ink-d)_38%,white)] [text-shadow:0_0_.45em_color-mix(in_oklab,var(--accent)_70%,transparent),0_0_1.1em_color-mix(in_oklab,var(--accent-2)_38%,transparent)]',
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
        </div>
      </div>

      {/* Progress: a thin line along the top edge, always there */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[env(safe-area-inset-top)] z-20 h-[3px] bg-white/[0.08]"
        aria-hidden
      >
        {/* Arabic fills from the right edge, so the origin is physical on purpose. */}
        <div
          ref={bar}
          className="h-full origin-right rounded-full bg-accent-gradient will-change-transform"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>

      <Countdown value={countdown} />

      {/* Short messages: they fade by themselves, whatever the controls are doing */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(8.25rem,calc(env(safe-area-inset-top)+7.25rem))] z-30 flex justify-center px-4"
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
        transition={{ duration: showChrome ? 0.25 : 0.7, ease: EASE_OUT }}
        className={cn(
          'fixed inset-x-0 top-0 z-20 flex flex-col gap-0.5 pt-[max(1rem,env(safe-area-inset-top))]',
          !showChrome && 'pointer-events-none',
        )}
      >
        <div className="flex items-center gap-3 px-4">
          <button
            type="button"
            onClick={exit}
            aria-label="خروج"
            title="خروج"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 backdrop-blur-xl transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-90"
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
            باقي{' '}
            <motion.span
              key={timeText}
              initial={reduce ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="num"
            >
              {timeText}
            </motion.span>
          </span>
        </div>
        <SectionChips
          chips={sections.map((s) => ({ key: s.key, label: s.label }))}
          active={activeSection}
          onJump={jumpTo}
        />
      </motion.header>

      {/* Controls, or the closing card once the last line has been read */}
      <AnimatePresence initial={false}>
        {finished ? (
          <FinishCard key="end" seconds={playedSec} onRestart={restart} onDone={exit} />
        ) : (
          <motion.div
            key="controls"
            initial={false}
            animate={{ opacity: showChrome ? 1 : 0, y: showChrome ? 0 : 20 }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.2 } }}
            transition={{ duration: showChrome ? 0.25 : 0.7, ease: EASE_OUT }}
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
            <PrompterControls
              running={playing || countdown !== null}
              voice={prefs.voice}
              mirror={prefs.mirror}
              speed={prefs.speed}
              sizeLevel={sizeLevel}
              leadingLevel={leadingLevel}
              lang={lang}
              onRestart={restart}
              onToggle={toggle}
              onToggleVoice={toggleVoice}
              onToggleMirror={() => setPrefs((p) => ({ ...p, mirror: !p.mirror }))}
              onSize={changeSize}
              onCycleLeading={() => setLeadingLevel((l) => (l + 1) % LEADING_LEVELS.length)}
              onSpeed={(speed) => setPrefs((p) => ({ ...p, speed }))}
              onLang={chooseLang}
            />
          </motion.div>
        )}
      </AnimatePresence>

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

/** One of the two focus marks at the edges of the band; they breathe very slightly. */
function FocusMark({ side, calm }: { side: 'start' | 'end'; calm: boolean }) {
  return (
    <motion.span
      className={cn(
        'absolute top-1/2 -mt-1.5 size-0 border-y-[6px] border-y-transparent',
        side === 'start'
          ? 'start-1.5 border-s-[9px] border-s-[var(--accent)]'
          : 'end-1.5 border-e-[9px] border-e-[var(--accent)]',
      )}
      animate={calm ? undefined : { opacity: [0.62, 1, 0.62], scale: [0.94, 1.08, 0.94] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
