// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { AlertTriangle, Globe, MicOff, ShieldCheck, TextCursorInput } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { detectDevice, type DeviceKind, type VoiceIssue } from '@/lib/voiceFollow';

/* The filming screen's own dialogs. The shared Sheet sits below the full-screen prompter,
   so these are drawn here in the prompter's dark glass: focus goes inside, Tab stays inside,
   and Escape means the safest choice (carry on at the steady speed, or go back). */

export type Dialog =
  | { kind: 'privacy'; action: 'enable' | 'start' }
  | { kind: 'ios'; action: 'enable' | 'start' }
  | { kind: 'blanks'; count: number }
  | { kind: 'problem'; issue: VoiceIssue; resume: boolean };

interface Handlers {
  /** Carry on with voice mode after the privacy note or the iPhone warning. */
  onContinueVoice: () => void;
  /** Voice mode off, steady speed instead. */
  onSteady: () => void;
  /** Try voice mode again after a problem. */
  onRetry: () => void;
  /** Go back and edit the script. */
  onEdit: () => void;
  /** Film with the blanks as they are. */
  onFilmAnyway: () => void;
}

const FOCUSABLE = 'button:not([disabled]),a[href],select,input,[tabindex]:not([tabindex="-1"])';

const STEPS: Record<DeviceKind, { name: string; text: string }> = {
  ios: { name: 'آيفون', text: 'الإعدادات ← Safari ← الميكروفون ← السماح' },
  android: {
    name: 'أندرويد',
    text: 'أيقونة القفل بجوار عنوان الصفحة ← الأذونات ← الميكروفون ← السماح',
  },
  desktop: {
    name: 'كمبيوتر',
    text: 'أيقونة القفل بجوار عنوان الصفحة ← الميكروفون ← السماح، ثم إعادة تحميل الصفحة',
  },
};

export function PrompterDialog({ dialog, ...h }: { dialog: Dialog } & Handlers) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  // Escape picks the safe way out of each dialog.
  const escape = () => {
    if (dialog.kind === 'blanks') h.onEdit();
    else h.onSteady();
  };
  const escapeRef = useRef(escape);
  useEffect(() => {
    escapeRef.current = escape;
  });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const el = panel.current;
      (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el)?.focus({ preventScroll: true });
    }, 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        escapeRef.current();
        return;
      }
      // Keep the prompter's own shortcuts (Space, Enter, arrows) from firing behind the dialog.
      if (e.key === ' ' || e.key === 'Enter' || e.key.startsWith('Arrow')) e.stopPropagation();
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  const openInSafari = () => {
    const url = window.location.href;
    try {
      void navigator.clipboard?.writeText(url).then(
        () => setCopied(true),
        () => setCopied(false),
      );
    } catch {
      /* clipboard unavailable */
    }
    window.open(url, '_blank', 'noopener');
    setCopied(true);
  };

  let icon: ReactNode;
  let title: string;
  let body: ReactNode;
  let buttons: ReactNode;

  if (dialog.kind === 'privacy') {
    icon = <ShieldCheck size={22} />;
    title = 'قبل تشغيل وضع الصوت';
    body = (
      <>
        <p>وضع «يتبع الصوت» يحتاج إنترنت، لأن المتصفح يعالج الصوت عند مزوّده وليس داخل التطبيق.</p>
        <p>
          بقية كواليس تعمل دون إنترنت، وبياناتها تبقى على الجهاز. التطبيق لا يحفظ أي تسجيل صوتي.
        </p>
      </>
    );
    buttons = (
      <>
        <DlgButton primary autoFocus onClick={h.onContinueVoice}>
          متابعة
        </DlgButton>
        <DlgButton onClick={h.onSteady}>أكمل بالسرعة الثابتة</DlgButton>
      </>
    );
  } else if (dialog.kind === 'ios') {
    icon = <Globe size={22} />;
    title = 'وضع الصوت غير موثوق هنا';
    body = (
      <>
        <p>
          على الآيفون قد لا يعمل التعرّف على الكلام داخل التطبيق المثبّت على الشاشة الرئيسية. الأضمن
          فتح الصفحة في Safari.
        </p>
        {copied && (
          <p role="status" className="text-[var(--accent-ink-d)]">
            نُسخ رابط الصفحة. يُلصق في شريط عنوان Safari إن لم تُفتح تلقائياً.
          </p>
        )}
      </>
    );
    buttons = (
      <>
        <DlgButton primary autoFocus onClick={openInSafari}>
          افتح في Safari
        </DlgButton>
        <DlgButton onClick={h.onSteady}>أكمل بالسرعة الثابتة</DlgButton>
        <DlgButton quiet onClick={h.onContinueVoice}>
          تجربة الصوت هنا على أي حال
        </DlgButton>
      </>
    );
  } else if (dialog.kind === 'blanks') {
    icon = <TextCursorInput size={22} />;
    title = 'في النص فراغات لم تُملأ';
    body = (
      <p>
        بقي في السكريبت <span className="num">{dialog.count}</span> من الفراغات (___) القادمة من
        القوالب. ستظهر كما هي على شاشة التصوير.
      </p>
    );
    buttons = (
      <>
        <DlgButton primary autoFocus onClick={h.onEdit}>
          ارجع وعدّل
        </DlgButton>
        <DlgButton onClick={h.onFilmAnyway}>صوّر كذلك</DlgButton>
      </>
    );
  } else {
    const { issue } = dialog;
    const order: DeviceKind[] = [
      detectDevice({ ua: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints }),
    ];
    for (const k of ['ios', 'android', 'desktop'] as const) if (!order.includes(k)) order.push(k);
    icon = issue.kind === 'permission' ? <MicOff size={22} /> : <AlertTriangle size={22} />;
    title = issue.title;
    body = (
      <>
        <p>{issue.text}</p>
        {issue.kind === 'permission' && (
          <div>
            <p className="mb-2 font-semibold text-white">خطوات تفعيل الإذن</p>
            <ul className="space-y-2">
              {order.map((k, n) => (
                <li
                  key={k}
                  className={cn(
                    'rounded-xl bg-white/5 px-3 py-2',
                    n === 0 && 'ring-1 ring-[var(--accent)]/50',
                  )}
                >
                  <span className="font-semibold text-white">{STEPS[k].name}: </span>
                  {STEPS[k].text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
    const canRetry = ['permission', 'network', 'device'].includes(issue.kind);
    buttons = (
      <>
        <DlgButton primary autoFocus onClick={h.onSteady}>
          أكمل بالسرعة الثابتة
        </DlgButton>
        {canRetry && <DlgButton onClick={h.onRetry}>إعادة المحاولة</DlgButton>}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-[26px] border border-white/10 bg-[#14141a] p-5 text-white shadow-2xl outline-none"
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-[var(--accent-ink-d)]">
            {icon}
          </span>
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
        </div>
        <div className="space-y-3 text-[15px] leading-7 text-white/80">{body}</div>
        <div className="mt-5 flex flex-col gap-2">{buttons}</div>
      </motion.div>
    </div>
  );
}

function DlgButton({
  children,
  onClick,
  primary,
  quiet,
  autoFocus,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  quiet?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      data-autofocus={autoFocus ? '' : undefined}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.97]',
        primary
          ? 'bg-accent-gradient-strong text-white'
          : quiet
            ? 'text-white/60 hover:text-white'
            : 'bg-white/10 text-white hover:bg-white/15',
      )}
    >
      {children}
    </button>
  );
}
