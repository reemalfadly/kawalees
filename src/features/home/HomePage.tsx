// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import {
  ArrowLeft,
  CalendarDays,
  CornerDownLeft,
  Flame,
  Layers,
  Lightbulb,
  Search,
  Shuffle,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { EmptyState } from '@/components/ui/EmptyState';
import { Kbd } from '@/components/ui/Field';
import { ProgressBar, ProgressRing } from '@/components/ui/ProgressRing';
import { STAGE_ICONS } from '@/components/ui/StageBadge';
import { DemoBanner } from '@/features/demo/DemoBanner';
import { InstallBanner } from '@/features/install/InstallBanner';
import { IdeaRow } from '@/features/ideas/IdeaRow';
import { useLiveIdeas, useSettings } from '@/hooks/data';
import { useLevel, useStreak, useWeekProgress } from '@/hooks/useProgress';
import { SPARK_PROMPTS, STAGE_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { formatDate, fromDayKey, greeting, monthKey, todayKey, weekKeys } from '@/lib/dates';
import { formatNumber, plural, pluralWord, WORDS } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { createIdea } from '@/lib/repo';
import { countByStage, publishedDayKey, upNext } from '@/lib/stats';
import { STAGES } from '@/lib/types';
import { toast, useUI } from '@/store/ui';

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

function Tile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div variants={rise} className={className}>
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  const settings = useSettings();
  const ideas = useLiveIdeas();
  const week = useWeekProgress();
  const streak = useStreak();
  const level = useLevel();
  const navigate = useNavigate();
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);

  const now = new Date();
  const today = todayKey(now);
  const hello = greeting(now);

  const days = useMemo(() => {
    return weekKeys(now, settings.weekStartsOn).map((key) => ({
      key,
      published: ideas.filter((i) => publishedDayKey(i) === key).length,
      scheduled: ideas.filter((i) => i.scheduledFor === key && i.stage !== 'published').length,
    }));
    // `now` changes every render; the week only needs recomputing when data or settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideas, settings.weekStartsOn, today]);

  const todays = ideas.filter((i) => i.scheduledFor === today && i.stage !== 'published');
  const next = upNext(ideas, 5).filter((i) => !todays.includes(i));
  const upcoming = ideas
    .filter((i) => i.scheduledFor && i.scheduledFor > today && i.stage !== 'published')
    .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
    .slice(0, 4);
  const counts = countByStage(ideas);
  const maxCount = Math.max(1, ...Object.values(counts));

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const showRecap =
    now.getDate() <= 10 &&
    ideas.some(
      (i) =>
        new Date(i.createdAt).getMonth() === lastMonth.getMonth() &&
        new Date(i.createdAt).getFullYear() === lastMonth.getFullYear(),
    );

  const goalMet = week.published >= week.goal;
  const remaining = Math.max(0, week.goal - week.published);

  return (
    <Page>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-x-2">
            <span>{formatDate.full(now)}</span>
            <span className="text-ink-3/70" aria-hidden>
              ·
            </span>
            <span>{formatDate.hijri(now)}</span>
          </span>
        }
        compactTitle="الرئيسية"
        title={
          <>
            {hello.text}
            {settings.name && <span className="text-gradient">، {settings.name}</span>}{' '}
            <span aria-hidden>{hello.emoji}</span>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="glass hidden h-11 items-center gap-2.5 rounded-2xl px-4 text-sm text-ink-3 transition-colors hover:text-ink-2 md:flex"
          >
            <Search size={16} />
            بحث
            <span className="flex gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        }
      />

      <DemoBanner ideas={ideas} />
      <InstallBanner />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5"
      >
        {/* Weekly goal */}
        <Tile className="md:col-span-7">
          <Card className={cn('relative h-full overflow-hidden', goalMet && 'shine-border')}>
            <div
              className="pointer-events-none absolute -top-24 -start-24 size-72 rounded-full opacity-60 blur-3xl"
              style={{ background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)' }}
              aria-hidden
            />
            <div className="relative flex items-center gap-5 sm:gap-7">
              <ProgressRing
                value={week.published / week.goal}
                size={128}
                stroke={11}
                label="تقدم هدف الأسبوع"
              >
                <div>
                  <p
                    className="num font-display text-[2rem] leading-none font-bold text-ink"
                    dir="ltr"
                  >
                    <AnimatedNumber value={week.published} />
                    <span className="text-lg text-ink-3">/{week.goal}</span>
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-ink-3">هالأسبوع</p>
                </div>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-3">هدف النشر الأسبوعي</p>
                <h2 className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">
                  {goalMet ? (
                    <span className="inline-flex items-center gap-2">
                      حققت الهدف <Trophy size={22} className="text-warn" />
                    </span>
                  ) : week.published === 0 ? (
                    'أسبوع جديد، بداية جديدة'
                  ) : (
                    `باقي ${plural(remaining, WORDS.post)} على الهدف`
                  )}
                </h2>
                {week.goalStreak > 1 && (
                  <p className="mt-1.5 text-sm text-ink-2">
                    🔥 {plural(week.goalStreak, WORDS.week)} ورا بعض محققة الهدف
                  </p>
                )}
                <Link
                  to="/calendar"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline"
                >
                  خطة الأسبوع <ArrowLeft size={15} />
                </Link>
              </div>
            </div>

            <ol className="relative mt-6 grid grid-cols-7 gap-1.5" aria-label="أيام هالأسبوع">
              {days.map((d) => {
                const date = fromDayKey(d.key);
                const isToday = d.key === today;
                const past = d.key < today;
                return (
                  <li
                    key={d.key}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition-colors',
                      isToday ? 'bg-surface-3 ring-1 ring-line-2' : '',
                    )}
                    aria-label={`${formatDate.weekdayLong(date)}: ${d.published} منشور، ${d.scheduled} مجدول`}
                  >
                    <span
                      className={cn(
                        'text-[11px] font-medium',
                        isToday ? 'text-accent-ink' : 'text-ink-3',
                      )}
                    >
                      {formatDate.weekdayShort(date)}
                    </span>
                    <span
                      className={cn(
                        'font-display text-base font-semibold',
                        past && !isToday ? 'text-ink-3' : 'text-ink',
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <span className="flex h-2 items-center gap-0.5" aria-hidden>
                      {d.published > 0 && (
                        <span className="size-2 rounded-full bg-accent-gradient" />
                      )}
                      {d.scheduled > 0 && (
                        <span className="size-2 rounded-full border-[1.5px] border-accent" />
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </Tile>

        {/* Streak + level */}
        <Tile className="md:col-span-5">
          <Card className="flex h-full flex-col">
            <div className="flex items-center gap-4">
              <div className="relative grid size-16 place-items-center rounded-[20px] bg-gradient-to-br from-[#ffb03a] to-[#ff4d4d] shadow-[0_12px_28px_-12px_#ff6b3d]">
                <Flame
                  size={34}
                  className={cn('text-white', streak.current > 0 && 'flame')}
                  fill="rgb(255 255 255 / 0.25)"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-3">سلسلة الإبداع</p>
                <p className="font-display text-3xl font-bold text-ink">
                  {streak.current > 2 ? (
                    <>
                      <AnimatedNumber value={streak.current} />{' '}
                      {pluralWord(streak.current, WORDS.day)}
                    </>
                  ) : streak.current > 0 ? (
                    plural(streak.current, WORDS.day)
                  ) : (
                    'يوم جديد'
                  )}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-2">
              {streak.current === 0
                ? 'أي خطوة اليوم، ولو فكرة وحدة، تشعل السلسلة'
                : streak.activeToday
                  ? 'اليوم محسوب ✓ الإبداع مستمر'
                  : 'خطوة وحدة اليوم تحافظ على السلسلة'}
              {streak.best > streak.current && (
                <span className="text-ink-3"> · أفضل سلسلة: {plural(streak.best, WORDS.day)}</span>
              )}
            </p>
            <Link to="/stats" className="mt-auto block pt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">
                  <span aria-hidden>{level.emoji}</span> المستوى {level.level} · {level.title}
                </span>
                <span className="text-xs text-ink-3">
                  <span className="num">{formatNumber(level.ceil - level.xp)}</span> نقطة للمستوى
                  الجاي
                </span>
              </div>
              <ProgressBar
                value={level.progress}
                label="التقدم للمستوى التالي"
                className="mt-2.5"
              />
            </Link>
          </Card>
        </Tile>

        {/* Inline capture */}
        <Tile className="md:col-span-12">
          <InlineCapture />
        </Tile>

        {/* Today + up next */}
        <Tile className="md:col-span-7">
          <Card className="h-full" padded={false}>
            <div className="p-5 pb-2 sm:p-6 sm:pb-2">
              <SectionTitle
                title="اليوم وبعده"
                subtitle={
                  todays.length > 0
                    ? `${plural(todays.length, WORDS.post)} مجدول لليوم`
                    : 'الشغل اللي ماشي عليه'
                }
                action={
                  <Link
                    to="/ideas?view=board"
                    className="text-sm font-semibold text-accent-ink hover:underline"
                  >
                    اللوحة
                  </Link>
                }
                className="mb-2"
              />
            </div>
            {todays.length + next.length === 0 ? (
              <EmptyState
                compact
                icon={Layers}
                title="ما في شغل جاري"
                description="أول ما تنتقل أي فكرة لمرحلة الكتابة أو التصوير، بتطلع هنا"
                action={
                  <Button variant="secondary" size="sm" onClick={() => navigate('/ideas')}>
                    بنك الأفكار
                  </Button>
                }
              />
            ) : (
              <div className="px-2 pb-3 sm:px-3">
                {todays.map((i) => (
                  <IdeaRow key={i.id} idea={i} showNext className="bg-accent-softer" />
                ))}
                {next.map((i) => (
                  <IdeaRow key={i.id} idea={i} showNext />
                ))}
              </div>
            )}
          </Card>
        </Tile>

        {/* Spark of the day */}
        <Tile className="md:col-span-5">
          <SparkCard />
        </Tile>

        {/* Pipeline */}
        <Tile className="md:col-span-7">
          <Card className="h-full">
            <SectionTitle
              title="خط الإنتاج"
              subtitle={`${plural(ideas.length, WORDS.idea)} بكل المراحل`}
              action={
                <Link
                  to="/ideas?view=board"
                  className="text-sm font-semibold text-accent-ink hover:underline"
                >
                  فتح اللوحة
                </Link>
              }
            />
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {STAGES.map((s) => {
                const Icon = STAGE_ICONS[s];
                const n = counts[s];
                return (
                  <li key={s}>
                    <Link
                      to={`/ideas?view=board&focus=${s}`}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-3.5 text-center transition-colors hover:border-line-2 hover:bg-surface-2"
                    >
                      <span
                        className="grid size-9 place-items-center rounded-xl"
                        style={{
                          background: `color-mix(in oklab, ${STAGE_META[s].color} 18%, transparent)`,
                          color: STAGE_META[s].color,
                        }}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="font-display text-xl font-bold text-ink">{n}</span>
                      <span className="text-xs text-ink-3">{STAGE_META[s].label}</span>
                      <span
                        className="h-1 w-full overflow-hidden rounded-full bg-surface-3"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${(n / maxCount) * 100}%`,
                            background: STAGE_META[s].color,
                          }}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Tile>

        {/* Upcoming / recap */}
        <Tile className="md:col-span-5">
          <div className="flex h-full flex-col gap-4 md:gap-5">
            {showRecap && (
              <Link
                to={`/recap?m=${monthKey(lastMonth)}`}
                className="group relative block overflow-hidden rounded-card bg-accent-gradient-strong p-5 text-white shadow-[0_20px_40px_-20px_var(--accent)] sm:p-6"
              >
                <div
                  className="absolute -top-10 -end-10 size-40 rounded-full bg-white/15 blur-2xl"
                  aria-hidden
                />
                <Sparkles size={22} className="mb-3" />
                <p className="font-display text-xl font-bold">
                  ملخص {formatDate.monthName(lastMonth)} جاهز
                </p>
                <p className="mt-1 text-sm text-white/85">شهرك بالأرقام، على شكل ستوري</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                  مشاهدة الملخص{' '}
                  <ArrowLeft
                    size={16}
                    className="transition-transform group-hover:-translate-x-1"
                  />
                </span>
              </Link>
            )}
            <Card className="flex-1" padded={false}>
              <div className="p-5 pb-2 sm:p-6 sm:pb-2">
                <SectionTitle title="الجاي بالجدول" className="mb-2" />
              </div>
              {upcoming.length === 0 ? (
                <div className="px-6 pb-6 text-sm text-ink-3">
                  ما في شي مجدول بعد.{' '}
                  <Link to="/calendar" className="font-semibold text-accent-ink hover:underline">
                    فتح التقويم
                  </Link>
                </div>
              ) : (
                <ul className="px-3 pb-3">
                  {upcoming.map((i) => {
                    const d = fromDayKey(i.scheduledFor!);
                    return (
                      <li key={i.id}>
                        <Link
                          to={`/idea/${i.id}`}
                          className="flex items-center gap-3.5 rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface-2"
                        >
                          <span className="flex w-11 shrink-0 flex-col items-center rounded-xl border border-line bg-surface py-1.5">
                            <span className="text-[10px] text-ink-3">
                              {formatDate.weekdayShort(d)}
                            </span>
                            <span className="font-display text-lg leading-tight font-bold text-ink">
                              {d.getDate()}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 text-sm font-medium text-ink">
                              {i.title}
                            </span>
                            <span className="text-xs text-ink-3">{STAGE_META[i.stage].label}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </Tile>
      </motion.div>

      <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-ink-3">
        <CalendarDays size={13} />
        {formatDate.fullWithYear(now)}
      </p>
    </Page>
  );
}

function InlineCapture() {
  const [value, setValue] = useState('');
  const openCapture = useUI((s) => s.openCapture);
  const navigate = useNavigate();
  const settings = useSettings();

  const submit = async () => {
    const title = value.trim();
    if (!title) {
      openCapture();
      return;
    }
    const idea = await createIdea({ title, platforms: settings.platforms.slice(0, 1) });
    setValue('');
    haptics.success();
    toast({
      title: 'انحفظت الفكرة ✨',
      tone: 'success',
      action: { label: 'فتح', run: () => navigate(`/idea/${idea.id}`) },
    });
  };

  return (
    <form
      className="glass flex items-center gap-3 rounded-[22px] p-2 ps-4 transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--accent-softer)]"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Lightbulb size={20} className="shrink-0 text-accent-ink" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="فكرة طارت على بالك؟ تنكتب هنا وتنحفظ فوراً"
        aria-label="إضافة فكرة سريعة"
        maxLength={300}
        className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
      />
      <Button
        type="submit"
        variant={value.trim() ? 'primary' : 'secondary'}
        size="sm"
        className="h-10 rounded-xl"
        icon={<CornerDownLeft size={15} />}
      >
        حفظ
      </Button>
    </form>
  );
}

function SparkCard() {
  const today = todayKey();
  const [offset, setOffset] = useState(0);
  const navigate = useNavigate();
  const idx = (hashString(today) + offset) % SPARK_PROMPTS.length;
  const prompt = SPARK_PROMPTS[idx] ?? '';

  const adopt = async () => {
    const idea = await createIdea({ title: prompt, spark: 2 });
    haptics.success();
    toast({
      title: 'صارت فكرة ✨',
      tone: 'success',
      action: { label: 'فتح', run: () => navigate(`/idea/${idea.id}`) },
    });
  };

  return (
    <Card className="relative h-full overflow-hidden">
      <div
        className="pointer-events-none absolute -bottom-20 -end-16 size-64 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent-2) 30%, transparent), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
            <Sparkles size={13} /> شرارة اليوم
          </span>
          <IconButton label="شرارة ثانية" size="sm" onClick={() => setOffset((o) => o + 1)}>
            <Shuffle size={16} />
          </IconButton>
        </div>
        <div className="flex flex-1 items-center py-6">
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.4 }}
            className="font-display text-[1.45rem] leading-[1.6] font-semibold text-ink md:text-[1.6rem]"
          >
            <span className="text-gradient">«</span>
            {prompt}
            <span className="text-gradient">»</span>
          </motion.p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={adopt}>
            تحويلها لفكرة
          </Button>
        </div>
      </div>
    </Card>
  );
}
