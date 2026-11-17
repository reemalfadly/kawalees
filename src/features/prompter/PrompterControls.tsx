// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { FlipHorizontal2, Mic, Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { DIALECTS, parseDialect, type DialectCode } from '@/lib/voiceFollow';
import { LEADING_LEVELS, SIZE_LEVELS } from './readingPrefs';

/* The control panel at the bottom of the filming screen. Every target is at least 44px. */

export interface ControlsProps {
  running: boolean;
  voice: boolean;
  mirror: boolean;
  speed: number;
  sizeLevel: number;
  leadingLevel: number;
  lang: DialectCode;
  onRestart: () => void;
  onToggle: () => void;
  onToggleVoice: () => void;
  onToggleMirror: () => void;
  onSize: (delta: 1 | -1) => void;
  onCycleLeading: () => void;
  onSpeed: (speed: number) => void;
  onLang: (code: DialectCode) => void;
}

export function PrompterControls(p: ControlsProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2.5 rounded-[28px] border border-white/10 bg-white/[0.07] p-3 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-1">
        <CtlButton label="من البداية" text="من البداية" onClick={p.onRestart}>
          <RotateCcw size={19} />
        </CtlButton>
        <CtlButton label="يتبع الصوت" text="يتبع الصوت" active={p.voice} onClick={p.onToggleVoice}>
          <Mic size={19} />
        </CtlButton>
        <button
          type="button"
          onClick={() => {
            haptics.tap();
            p.onToggle();
          }}
          aria-label={p.running ? 'إيقاف' : 'تشغيل'}
          title={p.running ? 'إيقاف' : 'تشغيل'}
          className="grid size-16 shrink-0 place-items-center rounded-full bg-accent-gradient-strong text-white shadow-[0_12px_30px_-10px_var(--accent)] transition-transform duration-150 active:scale-90"
        >
          {p.running ? (
            <Pause size={28} fill="currentColor" />
          ) : (
            <Play size={28} fill="currentColor" className="-me-1" />
          )}
        </button>
        <CtlButton
          label="ارتفاع السطر"
          text="السطر"
          hint={LEADING_LEVELS[p.leadingLevel]?.label}
          onClick={p.onCycleLeading}
        >
          <LeadingGlyph level={p.leadingLevel} />
        </CtlButton>
        <CtlButton
          label="عكس الصورة للمرآة"
          text="مرآة"
          active={p.mirror}
          onClick={p.onToggleMirror}
        >
          <FlipHorizontal2 size={19} />
        </CtlButton>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="حجم الخط"
          className="flex shrink-0 items-center rounded-2xl bg-white/5 p-0.5"
        >
          <CtlButton label="تصغير الخط" disabled={p.sizeLevel <= 0} onClick={() => p.onSize(-1)}>
            <span className="font-display text-[15px] leading-none font-semibold">أ</span>
          </CtlButton>
          <span className="flex items-center gap-1" aria-hidden>
            {SIZE_LEVELS.map((px, i) => (
              <span
                key={px}
                className={cn(
                  'size-1.5 rounded-full transition-[background-color,transform] duration-300',
                  i === p.sizeLevel ? 'scale-125 bg-white' : 'bg-white/25',
                )}
              />
            ))}
          </span>
          <CtlButton
            label="تكبير الخط"
            disabled={p.sizeLevel >= SIZE_LEVELS.length - 1}
            onClick={() => p.onSize(1)}
          >
            <span className="font-display text-[24px] leading-none font-semibold">أ</span>
          </CtlButton>
        </div>

        {p.voice ? (
          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/5 ps-3">
            <span className="text-xs text-white/60">اللهجة</span>
            <select
              value={p.lang}
              onChange={(e) => p.onLang(parseDialect(e.target.value))}
              aria-label="لهجة التعرّف على الكلام"
              className="min-h-11 min-w-0 flex-1 rounded-2xl bg-transparent pe-3 ps-1 text-sm font-semibold text-white outline-none"
            >
              {DIALECTS.map((d) => (
                <option key={d.code} value={d.code} className="bg-[#14141a] text-white">
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/5 px-3">
            <span className="text-xs text-white/60">السرعة</span>
            <input
              type="range"
              min={1}
              max={10}
              value={p.speed}
              onChange={(e) => p.onSpeed(Number(e.target.value))}
              aria-label="سرعة التمرير"
              className={cn(
                'h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent accent-[var(--accent)]',
                '[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/20',
                '[&::-webkit-slider-thumb]:-mt-2.5 [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md',
                '[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/20',
                '[&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white',
              )}
            />
            <span className="w-4 text-center text-sm font-semibold">
              <span className="num">{p.speed}</span>
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

/** Three lines whose spacing shows the current line height. */
function LeadingGlyph({ level }: { level: number }) {
  const gap = [3, 5, 7][level] ?? 5;
  const mid = 10;
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden>
      {[-1, 0, 1].map((n) => (
        <path
          key={n}
          d={`M3 ${mid + n * gap}h14`}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          style={{ transition: 'd 0.3s' }}
        />
      ))}
    </svg>
  );
}

export function CtlButton({
  label,
  text,
  hint,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  /** A visible caption under the icon, for buttons that are only an icon otherwise. */
  text?: string;
  /** The current value, shown in the tooltip. */
  hint?: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint ? `${label}: ${hint}` : label}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => {
        haptics.tap();
        onClick();
      }}
      className={cn(
        'flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-xl transition-[background-color,color,transform,opacity] duration-150 active:scale-90 disabled:opacity-30 disabled:active:scale-100',
        text ? 'px-2.5 py-1.5' : 'size-11',
        active ? 'bg-white text-black' : 'text-white/85 hover:bg-white/10',
      )}
    >
      {children}
      {text && <span className="text-xs leading-none font-medium">{text}</span>}
    </button>
  );
}
