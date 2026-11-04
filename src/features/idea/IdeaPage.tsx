// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Flame,
  LoaderCircle,
  MoreHorizontal,
  NotebookPen,
  PlayCircle,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Page } from '@/components/layout/Page';
import { RouteFallback } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { PlatformIcon } from '@/components/ui/PlatformIcon';
import { STAGE_ICONS } from '@/components/ui/StageBadge';
import { useIdeaActions } from '@/features/ideas/useIdeaActions';
import { useIdea, usePillars, useSettings } from '@/hooks/data';
import {
  CTA_TEMPLATES,
  FORMAT_META,
  HOOK_TEMPLATES,
  PLATFORM_META,
  SPARK_LABELS,
  STAGE_META,
} from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { formatDate, fromDayKey, relativeDayLabel } from '@/lib/dates';
import { plural, WORDS } from '@/lib/format';
import { touchActivity, updateIdea } from '@/lib/repo';
import { countWords, FORMAT_TARGET_SECONDS, formatDuration, speakingSeconds } from '@/lib/script';
import { nextStage, prevStage } from '@/lib/stats';
import { trackError } from '@/lib/tracker';
import { FORMATS, STAGES, type Idea, type PlatformId } from '@/lib/types';
import { toast } from '@/store/ui';

export default function IdeaPage() {
  const { id } = useParams();
  const idea = useIdea(id);
  if (idea === undefined) return <RouteFallback />;
  if (idea === null)
    return (
      <Page className="pt-16">
        <EmptyState
          icon={Sparkles}
          level={1}
          title="الفكرة مو موجودة"
          description="يمكن انحذفت، أو الرابط غلط."
          action={
            <Link to="/ideas" className="font-semibold text-accent-ink hover:underline">
              الرجوع للأفكار
            </Link>
          }
        />
      </Page>
    );
  return <Editor key={idea.id} idea={idea} />;
}

type TextField = 'title' | 'hook' | 'body' | 'cta' | 'notes';
type SaveState = 'saved' | 'dirty' | 'saving';

const ACTIVITY_EVERY = 10 * 60_000;

function Editor({ idea }: { idea: Idea }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const pillars = usePillars();
  const { moveTo, remove, duplicate, toggleArchive } = useIdeaActions();

  // Text is edited locally and saved in the background; everything else writes straight through.
  const [draft, setDraft] = useState<Record<TextField, string>>({
    title: idea.title,
    hook: idea.hook,
    body: idea.body,
    cta: idea.cta,
    notes: idea.notes,
  });
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const draftRef = useRef(draft);
  const pending = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const lastActivity = useRef(0);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!pending.current) return;
    pending.current = false;
    setSaveState('saving');
    try {
      const d = draftRef.current;
      await updateIdea(idea.id, { ...d, title: d.title.trim() || 'بدون عنوان' });
      if (Date.now() - lastActivity.current > ACTIVITY_EVERY) {
        lastActivity.current = Date.now();
        await touchActivity();
      }
      setSaveState(pending.current ? 'dirty' : 'saved');
    } catch (e) {
      pending.current = true;
      setSaveState('dirty');
      void trackError(e);
      toast({
        title: 'ما قدرنا نحفظ التعديل',
        description: 'بنحاول مرة ثانية تلقائياً',
        tone: 'error',
      });
    }
  }, [idea.id]);

  const edit = (field: TextField, value: string) => {
    const next = { ...draftRef.current, [field]: value };
    draftRef.current = next;
    setDraft(next);
    pending.current = true;
    setSaveState('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 600);
  };

  // Never lose a keystroke: flush when leaving the screen or backgrounding the app.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [flush]);

  const patch = (p: Partial<Idea>) => void updateIdea(idea.id, p).catch((e) => void trackError(e));

  const togglePlatform = (p: PlatformId) =>
    patch({
      platforms: idea.platforms.includes(p)
        ? idea.platforms.filter((x) => x !== p)
        : [...idea.platforms, p],
    });

  const words = countWords(draft.hook) + countWords(draft.body) + countWords(draft.cta);
  const seconds = speakingSeconds(words, settings.wordsPerMinute);
  const target = FORMAT_TARGET_SECONDS[idea.format];
  const overTarget = target != null && seconds > target;
  const next = nextStage(idea.stage);
  const prev = prevStage(idea.stage);

  const insertTemplate = (field: 'hook' | 'cta', text: string) => {
    const current = draftRef.current[field].trim();
    edit(field, current ? `${current}\n${text}` : text);
    window.setTimeout(() => {
      const el = document.getElementById(`field-${field}`) as HTMLTextAreaElement | null;
      if (!el) return;
      el.focus();
      const blank = el.value.lastIndexOf('___');
      if (blank >= 0) el.setSelectionRange(blank, blank + 3);
    }, 50);
  };

  const openPrompter = async () => {
    await flush();
    navigate(`/idea/${idea.id}/prompter`);
  };

  return (
    <Page>
      {/* Top bar */}
      <div className="sticky top-0 z-30 -mx-4 mb-2 flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 md:pt-6">
        <IconButton
          label="رجوع"
          variant="secondary"
          onClick={() => (history.length > 1 ? navigate(-1) : navigate('/ideas'))}
        >
          <ArrowRight size={19} />
        </IconButton>
        <SaveIndicator state={saveState} />
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="secondary"
            aria-label="وضع التصوير"
            icon={<PlayCircle size={18} />}
            onClick={openPrompter}
            disabled={words === 0}
          >
            <span className="hidden sm:inline">وضع التصوير</span>
            <span className="sm:hidden">تصوير</span>
          </Button>
          <Menu
            label="خيارات الفكرة"
            items={[
              {
                label: 'نسخة مكررة',
                icon: <Copy size={17} />,
                onSelect: () => void flush().then(() => duplicate(idea)),
              },
              {
                label: idea.archived ? 'إرجاع من الأرشيف' : 'أرشفة',
                icon: idea.archived ? <ArchiveRestore size={17} /> : <Archive size={17} />,
                onSelect: () => void toggleArchive(idea),
              },
              {
                label: 'حذف الفكرة',
                icon: <Trash2 size={17} />,
                danger: true,
                onSelect: () => {
                  pending.current = false;
                  void remove(idea, () => navigate('/ideas', { replace: true }));
                },
              },
            ]}
            trigger={(p) => (
              <IconButton label="خيارات" variant="secondary" {...p}>
                <MoreHorizontal size={19} />
              </IconButton>
            )}
          />
        </div>
      </div>

      {/* Title */}
      <textarea
        value={draft.title}
        onChange={(e) => edit('title', e.target.value.replace(/\n/g, ' '))}
        aria-label="عنوان الفكرة"
        placeholder="عنوان الفكرة"
        rows={1}
        maxLength={300}
        className="w-full resize-none bg-transparent font-display text-[1.9rem] leading-[1.35] font-bold text-ink outline-none placeholder:text-ink-3 md:text-[2.6rem]"
      />
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
        <span>
          {FORMAT_META[idea.format].emoji} {FORMAT_META[idea.format].label}
        </span>
        <span aria-hidden>·</span>
        <span>انكتبت {formatDate.dayMonth(new Date(idea.createdAt))}</span>
        {idea.publishedAt && (
          <>
            <span aria-hidden>·</span>
            <span className="text-accent-ink">
              نزلت {formatDate.dayMonth(new Date(idea.publishedAt))} 🚀
            </span>
          </>
        )}
      </p>

      {/* Stage stepper */}
      <Card className="mt-6 !p-3 sm:!p-4">
        <ol
          className="no-scrollbar flex items-center gap-1 overflow-x-auto"
          aria-label="مراحل الإنتاج"
        >
          {STAGES.map((s, i) => {
            const meta = STAGE_META[s];
            const Icon = STAGE_ICONS[s];
            const idx = STAGES.indexOf(idea.stage);
            const done = i < idx;
            const current = i === idx;
            return (
              <li key={s} className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void moveTo(idea, s)}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'relative flex min-w-[4.25rem] flex-1 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors',
                    current ? 'bg-surface-3' : 'hover:bg-surface-2',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-9 place-items-center rounded-full transition-all duration-300',
                      current && 'scale-110',
                    )}
                    style={{
                      background: done || current ? meta.color : 'var(--surface-3)',
                      color: done || current ? '#fff' : 'var(--ink-3)',
                      boxShadow: current
                        ? `0 0 0 4px color-mix(in oklab, ${meta.color} 25%, transparent)`
                        : undefined,
                    }}
                  >
                    {done ? <Check size={17} strokeWidth={2.6} /> : <Icon size={17} />}
                  </span>
                  <span className={cn('text-xs font-medium', current ? 'text-ink' : 'text-ink-3')}>
                    {meta.label}
                  </span>
                </button>
                {i < STAGES.length - 1 && (
                  <span
                    className="hidden h-0.5 w-4 shrink-0 rounded-full sm:block"
                    style={{
                      background: i < idx ? STAGE_META[STAGES[i + 1]!].color : 'var(--line-2)',
                    }}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <p className="me-auto text-sm text-ink-2">{STAGE_META[idea.stage].hint}</p>
          {prev && (
            <Button variant="ghost" size="sm" onClick={() => void moveTo(idea, prev)}>
              رجوع لـ«{STAGE_META[prev].label}»
            </Button>
          )}
          {next && (
            <Button
              variant="primary"
              size="sm"
              iconEnd={<ArrowLeft size={16} />}
              onClick={() => void moveTo(idea, next)}
            >
              {next === 'published' ? 'تم النشر 🚀' : `نقل لـ«${STAGE_META[next].label}»`}
            </Button>
          )}
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Script */}
        <div className="flex flex-col gap-4">
          <ScriptSection
            field="hook"
            title="الخطّاف"
            hint="أول 3 ثواني تقرر إذا بيكمل المشاهد أو لا"
            value={draft.hook}
            onChange={(v) => edit('hook', v)}
            placeholder="الجملة اللي توقف السكرول…"
            templates={HOOK_TEMPLATES}
            onTemplate={(t) => insertTemplate('hook', t)}
            accent
          />
          <ScriptSection
            field="body"
            title="المحتوى"
            hint="الفكرة الأساسية، خطوة بخطوة"
            value={draft.body}
            onChange={(v) => edit('body', v)}
            placeholder="السكريبت الكامل…"
            large
          />
          <ScriptSection
            field="cta"
            title="الدعوة للتفاعل"
            hint="شنو المطلوب من المشاهد بعد ما يخلص؟"
            value={draft.cta}
            onChange={(v) => edit('cta', v)}
            placeholder="احفظ، شارك، علّق…"
            templates={CTA_TEMPLATES}
            onTemplate={(t) => insertTemplate('cta', t)}
          />

          <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 !py-4">
            <Stat
              icon={<NotebookPen size={16} />}
              label="الكلمات"
              value={plural(words, WORDS.word)}
            />
            <Stat
              icon={<Clock size={16} />}
              label="مدة الكلام"
              value={
                <span className={cn('num', overTarget && 'text-warn')}>
                  {formatDuration(seconds)}
                </span>
              }
            />
            {target != null && (
              <p className={cn('text-xs', overTarget ? 'text-warn' : 'text-ink-3')}>
                {overTarget
                  ? `أطول من المثالي لـ${FORMAT_META[idea.format].label} (${formatDuration(target)})`
                  : `المثالي لـ${FORMAT_META[idea.format].label}: أقل من ${formatDuration(target)}`}
              </p>
            )}
            <Button
              variant="primary"
              size="sm"
              className="ms-auto"
              icon={<PlayCircle size={16} />}
              onClick={openPrompter}
              disabled={words === 0}
            >
              وضع التصوير
            </Button>
          </Card>
        </div>

        {/* Details */}
        <aside className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-ink">
              <CalendarDays size={18} className="text-accent-ink" />
              موعد النشر
            </h2>
            <div className="flex gap-2">
              <Input
                type="date"
                aria-label="تاريخ النشر"
                value={idea.scheduledFor ?? ''}
                onChange={(e) =>
                  patch({
                    scheduledFor: e.target.value || null,
                    scheduledTime: e.target.value ? idea.scheduledTime : null,
                  })
                }
                className="h-11 flex-1"
              />
              <Input
                type="time"
                aria-label="وقت النشر"
                value={idea.scheduledTime ?? ''}
                disabled={!idea.scheduledFor}
                onChange={(e) => patch({ scheduledTime: e.target.value || null })}
                className="h-11 w-32"
              />
            </div>
            {idea.scheduledFor ? (
              <div className="mt-2.5 flex items-center justify-between text-sm">
                <span className="text-ink-2">
                  {relativeDayLabel(idea.scheduledFor)} ·{' '}
                  {formatDate.dayMonth(fromDayKey(idea.scheduledFor))}
                </span>
                <button
                  type="button"
                  onClick={() => patch({ scheduledFor: null, scheduledTime: null })}
                  className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-bad"
                >
                  <X size={13} /> إلغاء
                </button>
              </div>
            ) : (
              <p className="mt-2.5 text-xs text-ink-3">الجدولة تحط الفكرة في التقويم</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">المنصات</h2>
            <div className="flex flex-wrap gap-2">
              {settings.platforms.map((p) => (
                <Chip
                  key={p}
                  selected={idea.platforms.includes(p)}
                  onClick={() => togglePlatform(p)}
                  icon={<PlatformIcon id={p} size={15} />}
                >
                  {PLATFORM_META[p].label}
                </Chip>
              ))}
            </div>

            <h2 className="mt-6 mb-3 font-display text-base font-semibold text-ink">النوع</h2>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <Chip key={f} selected={idea.format === f} onClick={() => patch({ format: f })}>
                  <span aria-hidden>{FORMAT_META[f].emoji}</span>
                  {FORMAT_META[f].label}
                </Chip>
              ))}
            </div>

            {pillars.length > 0 && (
              <>
                <h2 className="mt-6 mb-3 font-display text-base font-semibold text-ink">المحور</h2>
                <div className="flex flex-wrap gap-2">
                  {pillars.map((p) => (
                    <Chip
                      key={p.id}
                      selected={idea.pillarId === p.id}
                      onClick={() => patch({ pillarId: idea.pillarId === p.id ? null : p.id })}
                    >
                      <span aria-hidden>{p.emoji}</span>
                      {p.name}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            <h2 className="mt-6 mb-3 font-display text-base font-semibold text-ink">قوة الفكرة</h2>
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="قوة الفكرة">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={idea.spark === n}
                  aria-label={SPARK_LABELS[n]}
                  onClick={() => patch({ spark: n })}
                  className={cn(
                    'grid size-10 place-items-center rounded-xl border transition-all active:scale-90',
                    idea.spark >= n
                      ? 'border-transparent bg-accent-soft text-accent-ink'
                      : 'border-line text-ink-3',
                  )}
                >
                  <Flame size={18} fill={idea.spark >= n ? 'currentColor' : 'none'} />
                </button>
              ))}
              <span className="ms-2 text-sm text-ink-3">
                {SPARK_LABELS[idea.spark as 1 | 2 | 3]}
              </span>
            </div>
          </Card>

          <Card>
            <label
              htmlFor="field-notes"
              className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink"
            >
              <Wand2 size={17} className="text-accent-ink" />
              ملاحظات
            </label>
            <textarea
              id="field-notes"
              value={draft.notes}
              onChange={(e) => edit('notes', e.target.value)}
              placeholder="روابط، مراجع، أفكار للتصوير، موسيقى…"
              className="min-h-28 w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm leading-7 text-ink outline-none transition-colors focus:border-accent"
            />
          </Card>
        </aside>
      </div>
    </Page>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink-3"
      role="status"
      aria-live="polite"
    >
      {state === 'saved' ? (
        <>
          <Check size={14} className="text-good" /> محفوظ
        </>
      ) : state === 'saving' ? (
        <>
          <LoaderCircle size={14} className="animate-spin" /> جاري الحفظ
        </>
      ) : (
        <>
          <span className="size-1.5 rounded-full bg-warn" /> تعديلات
        </>
      )}
    </span>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-ink-2">
        {icon}
      </span>
      <div>
        <p className="text-xs text-ink-3">{label}</p>
        <p className="font-display text-base font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

function ScriptSection({
  field,
  title,
  hint,
  value,
  onChange,
  placeholder,
  templates,
  onTemplate,
  large,
  accent,
}: {
  field: 'hook' | 'body' | 'cta';
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  templates?: string[];
  onTemplate?: (t: string) => void;
  large?: boolean;
  accent?: boolean;
}) {
  const words = countWords(value);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="group relative !p-0 transition-[border-color] focus-within:border-line-2">
        {accent && (
          <span
            className="absolute inset-y-5 start-0 w-[3px] rounded-e-full bg-accent-gradient"
            aria-hidden
          />
        )}
        <div className="flex items-center gap-3 px-5 pt-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <label
              htmlFor={`field-${field}`}
              className="font-display text-base font-semibold text-ink"
            >
              {title}
            </label>
            <p className="text-xs text-ink-3">{hint}</p>
          </div>
          {words > 0 && <span className="text-xs text-ink-3">{plural(words, WORDS.word)}</span>}
          {templates && onTemplate && (
            <Menu
              label={`قوالب ${title}`}
              items={templates.map((t) => ({ label: t, onSelect: () => onTemplate(t) }))}
              trigger={(p) => (
                <button
                  type="button"
                  {...p}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent-ink transition-transform active:scale-95"
                >
                  <Sparkles size={13} />
                  قوالب
                </button>
              )}
            />
          )}
        </div>
        <textarea
          id={`field-${field}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full resize-none bg-transparent px-5 pt-3 pb-5 text-[17px] leading-[1.95] text-ink outline-none placeholder:text-ink-3 sm:px-6',
            large ? 'min-h-56' : 'min-h-24',
          )}
        />
      </Card>
    </motion.div>
  );
}
