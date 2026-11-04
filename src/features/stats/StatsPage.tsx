// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Heatmap } from '@/components/charts/Heatmap';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { LineChart } from '@/components/charts/LineChart';
import { WeeklyBars } from '@/components/charts/WeeklyBars';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input } from '@/components/ui/Field';
import { PlatformIcon } from '@/components/ui/PlatformIcon';
import { ProgressBar } from '@/components/ui/ProgressRing';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useActivity, useActivityMap, useLiveIdeas, useSettings, useStats } from '@/hooks/data';
import { useIsTablet } from '@/hooks/useMediaQuery';
import { useLevel, useStreak, useWeekProgress } from '@/hooks/useProgress';
import { PLATFORM_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { formatDate, fromDayKey, monthKey, todayKey } from '@/lib/dates';
import { formatCompact, formatNumber, formatSigned, plural, WORDS } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { addStat, deleteStat, restoreStat } from '@/lib/repo';
import {
  achievements,
  followerSeries,
  heatmapWeeks,
  LEVELS,
  monthRecap,
  seriesDelta,
} from '@/lib/stats';
import type { PlatformId } from '@/lib/types';
import { toast } from '@/store/ui';

export default function StatsPage() {
  const ideas = useLiveIdeas();
  const stats = useStats();
  const activityRows = useActivity();
  const activity = useActivityMap();
  const settings = useSettings();
  const level = useLevel();
  const streak = useStreak();
  const week = useWeekProgress();
  const tablet = useIsTablet();
  const [logOpen, setLogOpen] = useState(false);

  const now = new Date();
  const activeDays = useMemo(
    () => activityRows.filter((r) => r.count > 0).map((r) => r.day),
    [activityRows],
  );
  const recap = useMemo(
    () => monthRecap(ideas, stats, activeDays, now.getFullYear(), now.getMonth()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ideas, stats, activeDays],
  );
  const heat = useMemo(
    () => heatmapWeeks(activity, tablet ? 22 : 15, settings.weekStartsOn),
    [activity, tablet, settings.weekStartsOn],
  );
  const badges = useMemo(
    () =>
      achievements({
        ideas,
        stats,
        activeDays,
        weeklyGoal: settings.weeklyGoal,
        weekStartsOn: settings.weekStartsOn,
      }),
    [ideas, stats, activeDays, settings.weeklyGoal, settings.weekStartsOn],
  );
  const unlocked = badges.filter((b) => b.unlocked).length;
  const nextLevel = LEVELS[Math.min(level.level, LEVELS.length - 1)];

  const tiles = [
    { label: 'نشرت هالشهر', value: recap.published, prev: recap.prevPublished },
    { label: 'أفكار جديدة', value: recap.ideasCreated, prev: recap.prevIdeasCreated },
    { label: 'كلمات انكتبت', value: recap.wordsWritten, prev: null },
    { label: 'أيام نشاط', value: recap.activeDays, prev: null },
  ];

  return (
    <Page>
      <PageHeader
        title="الأرقام"
        subtitle={`${formatDate.monthYear(now)} · نموك بلغة الأرقام`}
        actions={
          <Button
            variant="primary"
            className="hidden md:inline-flex"
            icon={<Plus size={18} />}
            onClick={() => setLogOpen(true)}
          >
            تسجيل الأرقام
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {tiles.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="h-full !p-4 sm:!p-5">
              <p className="text-sm text-ink-3">{t.label}</p>
              <p className="mt-1.5 font-display text-3xl font-bold text-ink">
                <AnimatedNumber value={t.value} format={formatCompact} />
              </p>
              {t.prev != null && <Delta value={t.value - t.prev} suffix="عن الشهر اللي فات" />}
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:mt-5 md:grid-cols-12 md:gap-5">
        {/* Level */}
        <Card className="relative overflow-hidden md:col-span-7">
          <div
            className="pointer-events-none absolute -top-20 -end-20 size-72 rounded-full opacity-70 blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)' }}
            aria-hidden
          />
          <div className="relative flex items-center gap-5">
            <motion.div
              initial={{ scale: 0.6, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="grid size-20 shrink-0 place-items-center rounded-[26px] border border-line bg-surface-2 text-5xl"
              aria-hidden
            >
              {level.emoji}
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-3">المستوى {level.level}</p>
              <p className="font-display text-3xl font-bold text-ink">{level.title}</p>
              <p className="mt-1 text-sm text-ink-2">
                <span className="num">{formatNumber(level.xp)}</span> نقطة خبرة
              </p>
            </div>
          </div>
          <div className="relative mt-6">
            <div className="mb-2 flex justify-between text-xs text-ink-3">
              <span>
                باقي <span className="num">{formatNumber(level.ceil - level.xp)}</span> نقطة
              </span>
              {nextLevel && (
                <span>
                  الجاي: {nextLevel.emoji} {nextLevel.title}
                </span>
              )}
            </div>
            <ProgressBar value={level.progress} label="التقدم للمستوى التالي" className="h-2.5" />
            <p className="mt-4 text-xs leading-6 text-ink-3">
              النقاط من كل خطوة: فكرة 5، كتابة 15، تصوير 25، مونتاج 35، جاهز 45، نشر 100، سكريبت
              مكتمل 15، تسجيل أرقام 5
            </p>
          </div>
        </Card>

        {/* Streaks */}
        <Card className="md:col-span-5">
          <div className="grid h-full grid-cols-2 gap-4">
            <StreakStat emoji="🔥" value={streak.current} label="سلسلة الإبداع" unit={WORDS.day} />
            <StreakStat emoji="🏆" value={streak.best} label="أفضل سلسلة" unit={WORDS.day} />
            <StreakStat emoji="🎯" value={week.goalStreak} label="أسابيع الهدف" unit={WORDS.week} />
            <StreakStat emoji="🏅" value={unlocked} label="إنجازات" total={badges.length} />
          </div>
        </Card>

        {/* Followers */}
        <Card className="md:col-span-12">
          <FollowersPanel onLog={() => setLogOpen(true)} />
        </Card>

        {/* Weekly cadence */}
        <Card className="md:col-span-5">
          <SectionTitle
            title="النشر الأسبوعي"
            subtitle={`آخر 8 أسابيع · الهدف ${week.goal} بالأسبوع`}
          />
          <WeeklyBars weeks={week.history} goal={week.goal} />
        </Card>

        {/* Heatmap */}
        <Card className="md:col-span-7">
          <SectionTitle
            title="خريطة النشاط"
            subtitle="كل مربع يوم، وكل ما زاد اللون زادت الخطوات"
          />
          <Heatmap weeks={heat} />
        </Card>

        {/* Achievements */}
        <Card className="md:col-span-12">
          <SectionTitle
            title="الإنجازات"
            subtitle={`${unlocked} من ${badges.length} مفتوحة`}
            action={
              <Link
                to={`/recap?m=${monthKey(now)}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline"
              >
                <Sparkles size={15} /> ملخص الشهر
              </Link>
            }
          />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {badges.map((b, i) => (
              <motion.li
                key={b.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  'relative flex flex-col items-center rounded-2xl border p-4 text-center',
                  b.unlocked
                    ? 'border-line bg-surface-2'
                    : 'border-dashed border-line bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'mb-2 grid size-14 place-items-center rounded-2xl text-3xl',
                    b.unlocked ? 'bg-accent-soft' : 'bg-surface-2 grayscale',
                  )}
                  aria-hidden
                >
                  {b.unlocked ? b.emoji : <Lock size={20} className="text-ink-3" />}
                </span>
                <p className={cn('text-sm font-semibold', b.unlocked ? 'text-ink' : 'text-ink-2')}>
                  {b.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-3">{b.description}</p>
                {!b.unlocked && (
                  <div className="mt-3 w-full">
                    <ProgressBar
                      value={b.current / b.target}
                      label={`تقدم ${b.title}`}
                      className="h-1.5"
                    />
                    <p className="mt-1.5 text-[11px] text-ink-3">
                      <span className="num">
                        {b.current}/{b.target}
                      </span>
                    </p>
                  </div>
                )}
              </motion.li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="fixed end-5 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-30 md:hidden">
        <Button
          variant="primary"
          className="rounded-full shadow-lg"
          icon={<Plus size={18} />}
          onClick={() => setLogOpen(true)}
        >
          تسجيل الأرقام
        </Button>
      </div>

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} platforms={settings.platforms} />
    </Page>
  );
}

function Delta({ value, suffix }: { value: number; suffix: string }) {
  if (value === 0)
    return <p className="mt-1 text-xs text-ink-3">نفس {suffix.replace('عن ', '')}</p>;
  const up = value > 0;
  return (
    <p
      className={cn(
        'mt-1 inline-flex items-center gap-1 text-xs font-medium',
        up ? 'text-good' : 'text-bad',
      )}
    >
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      <span className="num">{formatSigned(value)}</span>
      <span className="font-normal text-ink-3">{suffix}</span>
    </p>
  );
}

function StreakStat({
  emoji,
  value,
  label,
  unit,
  total,
}: {
  emoji: string;
  value: number;
  label: string;
  unit?: { one: string; two: string; few: string; many: string };
  total?: number;
}) {
  return (
    <div className="flex flex-col justify-center rounded-2xl bg-surface-2 p-4">
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <p className="mt-2 font-display text-2xl font-bold text-ink">
        {total != null ? (
          <span className="num">
            {value}/{total}
          </span>
        ) : (
          value
        )}
      </p>
      <p className="text-xs text-ink-3">
        {label}
        {unit && value > 0 ? ` · ${plural(value, unit).replace(/^[\d,]+ /, '')}` : ''}
      </p>
    </div>
  );
}

function FollowersPanel({ onLog }: { onLog: () => void }) {
  const stats = useStats();
  const settings = useSettings();
  const withData = settings.platforms.filter((p) => stats.some((s) => s.platform === p));
  const [chosen, setChosen] = useState<PlatformId | null>(null);
  const platform = chosen && withData.includes(chosen) ? chosen : (withData[0] ?? null);
  const series = platform ? followerSeries(stats, platform) : [];
  const delta = seriesDelta(series);
  const first = series[0];
  const recent = [...stats]
    .filter((s) => s.platform === platform)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 4);

  const remove = async (id: string) => {
    const removed = await deleteStat(id);
    if (removed)
      toast({
        title: 'انحذف التسجيل',
        action: { label: 'تراجع', run: () => void restoreStat(removed) },
      });
  };

  if (!platform)
    return (
      <EmptyState
        compact
        icon={TrendingUp}
        title="ما في أرقام مسجلة"
        description="تسجيل عدد المتابعين كل أسبوع يرسم لك خط النمو هنا"
        action={
          <Button variant="primary" icon={<Plus size={18} />} onClick={onLog}>
            أول تسجيل
          </Button>
        }
      />
    );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">المتابعين</h2>
          <p className="mt-1 font-display text-4xl font-bold text-ink">
            <span className="num">{formatNumber(delta?.latest ?? 0)}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {delta?.delta != null && <Delta value={delta.delta} suffix="عن التسجيل اللي قبل" />}
            {first && series.length > 1 && (
              <span className="text-xs text-ink-3">
                <span className="num">{formatSigned((delta?.latest ?? 0) - first.value)}</span> من{' '}
                {formatDate.dayMonth(fromDayKey(first.date))}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {withData.length > 1 && (
            <Segmented
              size="sm"
              label="المنصة"
              value={platform}
              onChange={setChosen}
              options={withData.map((p) => ({
                value: p,
                label: PLATFORM_META[p].label,
                icon: <PlatformIcon id={p} size={14} />,
              }))}
            />
          )}
          <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={onLog}>
            تسجيل
          </Button>
        </div>
      </div>
      <LineChart points={series} label={`متابعين ${PLATFORM_META[platform].label} مع الوقت`} />
      {recent.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium text-ink-3">آخر التسجيلات</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {recent.map((s) => (
              <li
                key={s.id}
                className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2"
              >
                <span className="text-sm text-ink-2">
                  {formatDate.dayMonth(fromDayKey(s.date))}
                </span>
                <span className="num text-sm font-semibold text-ink">
                  {formatNumber(s.followers)}
                </span>
                {s.views != null && (
                  <span className="text-xs text-ink-3">· {formatCompact(s.views)} مشاهدة</span>
                )}
                <IconButton
                  label="حذف التسجيل"
                  size="sm"
                  className="ms-auto opacity-60 group-hover:opacity-100"
                  onClick={() => void remove(s.id)}
                >
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LogSheet({
  open,
  onClose,
  platforms,
}: {
  open: boolean;
  onClose: () => void;
  platforms: PlatformId[];
}) {
  const [platform, setPlatform] = useState<PlatformId>(platforms[0] ?? 'instagram');
  const [date, setDate] = useState(todayKey());
  const [followers, setFollowers] = useState('');
  const [views, setViews] = useState('');

  const parse = (s: string) =>
    Number(s.replace(/[,\s٬]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
  const f = parse(followers);
  const v = views.trim() ? parse(views) : null;
  const valid =
    followers.trim() !== '' &&
    Number.isFinite(f) &&
    f >= 0 &&
    (v === null || (Number.isFinite(v) && v >= 0));

  const save = async () => {
    if (!valid) return;
    await addStat({
      platform,
      date,
      followers: Math.round(f),
      views: v === null ? null : Math.round(v),
    });
    haptics.success();
    toast({ title: 'انسجلت الأرقام 📈', tone: 'success' });
    setFollowers('');
    setViews('');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="تسجيل الأرقام"
      description="تسجيل أسبوعي بسيط يكفي عشان يبان خط النمو"
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!valid}
          onClick={() => void save()}
          iconEnd={<ArrowLeft size={18} />}
        >
          حفظ
        </Button>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset>
          <legend className="mb-2.5 text-sm font-medium text-ink-2">المنصة</legend>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <Chip
                key={p}
                selected={platform === p}
                onClick={() => setPlatform(p)}
                icon={<PlatformIcon id={p} size={15} />}
              >
                {PLATFORM_META[p].label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Field label="عدد المتابعين">
          {(id) => (
            <Input
              id={id}
              data-autofocus
              inputMode="numeric"
              value={followers}
              onChange={(e) => setFollowers(e.target.value)}
              placeholder="مثلاً 12500"
              dir="ltr"
              className="text-end"
            />
          )}
        </Field>
        <Field label="المشاهدات (اختياري)" hint="مجموع مشاهدات الأسبوع أو آخر منشور">
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              value={views}
              onChange={(e) => setViews(e.target.value)}
              dir="ltr"
              className="text-end"
            />
          )}
        </Field>
        <Field label="التاريخ">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={date}
              max={todayKey()}
              onChange={(e) => setDate(e.target.value || todayKey())}
            />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
