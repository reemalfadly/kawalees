// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { CalendarPlus, Flame, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Field';
import { PlatformIcon } from '@/components/ui/PlatformIcon';
import { Sheet } from '@/components/ui/Sheet';
import { usePillars, useSettings } from '@/hooks/data';
import { FORMAT_META, PLATFORM_META, SPARK_LABELS, SPARK_PROMPTS } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { formatDate, fromDayKey } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { createIdea } from '@/lib/repo';
import { FORMATS, type Format, type PlatformId } from '@/lib/types';
import { toast, useUI } from '@/store/ui';

const PREFS_KEY = 'kawalees:capture-prefs';

function loadPrefs(): { platforms: PlatformId[]; format: Format } | null {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function savePrefs(platforms: PlatformId[], format: Format) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ platforms, format }));
  } catch {
    /* ignore */
  }
}

export function QuickCapture() {
  const { open, preset } = useUI((s) => s.capture);
  const close = useUI((s) => s.closeCapture);
  const celebrate = useUI((s) => s.celebrate);
  const settings = useSettings();
  const pillars = usePillars();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [platforms, setPlatforms] = useState<PlatformId[]>([]);
  const [format, setFormat] = useState<Format>('reel');
  const [pillarId, setPillarId] = useState<string | null>(null);
  const [spark, setSpark] = useState<1 | 2 | 3>(2);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset the form each time the sheet opens, applying any preset (e.g. a day from the calendar).
  // Adjusting state while rendering (instead of in an effect) avoids a flash of the old values.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const prefs = loadPrefs();
      setTitle(preset?.title ?? '');
      setPlatforms(
        preset?.platforms ??
          prefs?.platforms?.filter((p) => settings.platforms.includes(p)) ??
          settings.platforms.slice(0, 1),
      );
      setFormat(preset?.format ?? prefs?.format ?? 'reel');
      setPillarId(preset?.pillarId ?? null);
      setSpark(preset?.spark === 1 || preset?.spark === 3 ? preset.spark : 2);
      setScheduledFor(preset?.scheduledFor ?? null);
      setShowDate(Boolean(preset?.scheduledFor));
      setSaving(false);
    }
  }

  const togglePlatform = (p: PlatformId) =>
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const save = async (openAfter: boolean) => {
    const clean = title.trim();
    if (!clean || saving) return;
    setSaving(true);
    try {
      const idea = await createIdea({
        title: clean,
        platforms,
        format,
        pillarId,
        spark,
        scheduledFor,
        stage: preset?.stage,
      });
      savePrefs(platforms, format);
      haptics.success();
      if (spark === 3) celebrate();
      close();
      if (openAfter) navigate(`/idea/${idea.id}`);
      else
        toast({
          title: 'انحفظت الفكرة ✨',
          description: clean.length > 42 ? `${clean.slice(0, 42)}…` : clean,
          tone: 'success',
          action: { label: 'فتح', run: () => navigate(`/idea/${idea.id}`) },
        });
    } catch {
      setSaving(false);
      toast({
        title: 'ما قدرنا نحفظ الفكرة',
        description: 'صار خلل بسيط، الرجاء المحاولة مرة ثانية',
        tone: 'error',
      });
    }
  };

  const spin = () => {
    const pool = SPARK_PROMPTS.filter((p) => p !== title);
    setTitle(pool[Math.floor(Math.random() * pool.length)] ?? '');
    haptics.tap();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="فكرة جديدة"
      description="تنحفظ بثانية، والتفاصيل بعدين"
      footer={
        <div className="flex gap-2.5">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={!title.trim() || saving}
            onClick={() => save(false)}
          >
            حفظ الفكرة
          </Button>
          <Button
            variant="secondary"
            size="lg"
            disabled={!title.trim() || saving}
            onClick={() => save(true)}
          >
            حفظ وفتح
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <div className="relative">
          <textarea
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void save(e.metaKey || e.ctrlKey);
              }
            }}
            placeholder="شنو الفكرة؟"
            aria-label="عنوان الفكرة الجديدة"
            rows={2}
            maxLength={300}
            className="w-full resize-none rounded-2xl border border-line bg-surface-2 px-4 pt-3.5 pb-12 font-display text-lg leading-8 font-medium text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-softer)]"
          />
          <button
            type="button"
            onClick={spin}
            className="absolute bottom-3 start-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent-ink transition-transform active:scale-95"
          >
            <Sparkles size={14} />
            عطني شرارة
          </button>
        </div>

        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-ink-2">المنصات</legend>
          <div className="flex flex-wrap gap-2">
            {settings.platforms.map((p) => (
              <Chip
                key={p}
                selected={platforms.includes(p)}
                onClick={() => togglePlatform(p)}
                icon={<PlatformIcon id={p} size={15} />}
              >
                {PLATFORM_META[p].label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-ink-2">نوع المحتوى</legend>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
            {FORMATS.map((f) => (
              <Chip key={f} selected={format === f} onClick={() => setFormat(f)}>
                <span aria-hidden>{FORMAT_META[f].emoji}</span>
                {FORMAT_META[f].label}
              </Chip>
            ))}
          </div>
        </fieldset>

        {pillars.length > 0 && (
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium text-ink-2">المحور</legend>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
              {pillars.map((p) => (
                <Chip
                  key={p.id}
                  selected={pillarId === p.id}
                  onClick={() => setPillarId(pillarId === p.id ? null : p.id)}
                >
                  <span aria-hidden>{p.emoji}</span>
                  {p.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium text-ink-2">قوة الفكرة</legend>
            <div className="flex gap-1.5" role="radiogroup" aria-label="قوة الفكرة">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={spark === n}
                  aria-label={SPARK_LABELS[n]}
                  title={SPARK_LABELS[n]}
                  onClick={() => setSpark(n)}
                  className={cn(
                    'grid size-11 place-items-center rounded-2xl border transition-all active:scale-90',
                    spark >= n
                      ? 'border-transparent bg-accent-soft text-accent-ink'
                      : 'border-line text-ink-3 hover:text-ink-2',
                  )}
                >
                  <Flame size={20} fill={spark >= n ? 'currentColor' : 'none'} strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </fieldset>

          {showDate ? (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="تاريخ النشر"
                value={scheduledFor ?? ''}
                onChange={(e) => setScheduledFor(e.target.value || null)}
                className="h-11 w-auto"
              />
              <button
                type="button"
                aria-label="إلغاء الجدولة"
                onClick={() => {
                  setScheduledFor(null);
                  setShowDate(false);
                }}
                className="grid size-11 place-items-center rounded-2xl text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={<CalendarPlus size={16} />}
              onClick={() => setShowDate(true)}
            >
              جدولة النشر
            </Button>
          )}
        </div>
        {scheduledFor && (
          <p className="-mt-3 text-xs text-ink-3">
            موعد النشر: {formatDate.full(fromDayKey(scheduledFor))}
          </p>
        )}
      </form>
    </Sheet>
  );
}
