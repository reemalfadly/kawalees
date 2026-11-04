import {
  Bug,
  Check,
  Download,
  FlaskConical,
  HardDrive,
  History,
  MonitorSmartphone,
  MoonStar,
  Palette,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  SunMedium,
  Trash2,
  Upload,
  UserRound,
  Layers,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Field';
import { GlyphTile } from '@/components/ui/GlyphTile';
import { LogoMark } from '@/components/ui/Logo';
import { PlatformIcon } from '@/components/ui/PlatformIcon';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Switch } from '@/components/ui/Switch';
import { useLiveIdeas, usePillars, useSettings } from '@/hooks/data';
import {
  downloadJson,
  exportBackup,
  parseBackup,
  restoreBackup,
  restoreSnapshot,
  startFresh,
  takeSnapshot,
} from '@/lib/backup';
import { ACCENT_META, AVATARS, PLATFORM_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import { db } from '@/lib/db';
import { formatDate, todayKey } from '@/lib/dates';
import { formatNumber, plural, WORDS } from '@/lib/format';
import { deletePillar, savePillar, updateSettings } from '@/lib/repo';
import { isDemoData } from '@/lib/seed';
import { AUTHOR, COPYRIGHT, LINKS } from '@/lib/about';
import { trackError } from '@/lib/tracker';
import { ACCENTS, PLATFORMS, type SnapshotReason } from '@/lib/types';
import { toast, useUI } from '@/store/ui';
import { InstallGuide } from '@/features/install/InstallGuide';

function Section({
  icon,
  title,
  description,
  from,
  to,
  children,
  id,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  from?: string;
  to?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Card id={id} className="scroll-mt-6">
      <div className="mb-5 flex items-center gap-3.5">
        <GlyphTile icon={icon} from={from} to={to} />
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          {description && <p className="text-sm text-ink-3">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

type Confirm = {
  title: string;
  description: string;
  action: string;
  danger?: boolean;
  run: () => Promise<void>;
} | null;

const REASONS: Record<SnapshotReason, string> = {
  daily: 'نسخة يومية تلقائية',
  'before-import': 'قبل الاستيراد',
  'before-reset': 'قبل المسح',
  'before-demo': 'قبل البيانات التجريبية',
  'before-restore': 'قبل الاسترجاع',
  manual: 'نسخة يدوية',
};

export default function SettingsPage() {
  const settings = useSettings();
  const pillars = usePillars();
  const demo = isDemoData(useLiveIdeas());
  const setFreshOpen = useUI((s) => s.setFreshOpen);
  const [name, setName] = useState(settings.name);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const snapshots = useLiveQuery(() => db.snapshots.orderBy('at').reverse().toArray(), [], []);
  const errors = useLiveQuery(() => db.errors.orderBy('at').reverse().limit(30).toArray(), [], []);
  const counts = useLiveQuery(
    async () => ({ ideas: await db.ideas.count(), stats: await db.stats.count() }),
    [],
    { ideas: 0, stats: 0 },
  );

  const saveName = () => {
    const clean = name.trim();
    if (clean !== settings.name) void updateSettings({ name: clean });
  };

  const exportNow = async () => {
    const backup = await exportBackup();
    downloadJson(`kawalees-backup-${todayKey()}.json`, backup);
    toast({
      title: 'انحفظت النسخة الاحتياطية',
      description: 'الملف نزل على الجهاز',
      tone: 'success',
    });
  };

  const importFile = async (file: File) => {
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      toast({ title: 'ما قدرنا نقرأ الملف', description: parsed.error, tone: 'error' });
      return;
    }
    setConfirm({
      title: 'استيراد النسخة؟',
      description: `بتتبدل البيانات الحالية بـ ${plural(parsed.backup.data.ideas.length, WORDS.idea)} و${plural(parsed.backup.data.stats.length, WORDS.entry)} من الملف. قبلها ناخذ نسخة من الحالي، والرجوع لها متاح بأي وقت.`,
      action: 'استيراد',
      run: async () => {
        await takeSnapshot('before-import');
        await restoreBackup(parsed.backup);
        toast({ title: 'تم الاستيراد', tone: 'success' });
      },
    });
  };

  const run = async (c: NonNullable<Confirm>) => {
    setBusy(true);
    try {
      await c.run();
    } catch (e) {
      void trackError(e);
      toast({
        title: 'صار خلل',
        description: e instanceof Error ? e.message : undefined,
        tone: 'error',
      });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <Page>
      <PageHeader title="الإعدادات" subtitle="كواليس على مقاسك" hideProfile />

      <div className="grid grid-cols-1 items-start gap-4 md:gap-5 lg:grid-cols-2">
        <Section icon={UserRound} title="الملف الشخصي" from="#ff8a4c" to="#ff3d7f">
          <div className="flex items-center gap-4">
            <span
              className="grid size-16 shrink-0 place-items-center rounded-[22px] border border-line bg-surface-2 text-3xl"
              aria-hidden
            >
              {settings.avatar}
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              placeholder="الاسم"
              aria-label="الاسم"
              maxLength={40}
            />
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12 lg:grid-cols-6 xl:grid-cols-12">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                aria-label={`الرمز ${a}`}
                aria-pressed={settings.avatar === a}
                onClick={() => void updateSettings({ avatar: a })}
                className={cn(
                  'grid aspect-square place-items-center rounded-xl border text-xl transition-all active:scale-90',
                  settings.avatar === a
                    ? 'border-accent bg-accent-soft'
                    : 'border-line hover:bg-surface-2',
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </Section>

        <Section
          icon={Palette}
          title="المظهر"
          description="الألوان تتغير فوراً بكل التطبيق"
          from="#a78bfa"
          to="#d946ef"
        >
          <Row label="الوضع">
            <Segmented
              label="الوضع"
              value={settings.theme}
              onChange={(theme) => void updateSettings({ theme })}
              options={[
                { value: 'system', label: 'تلقائي', icon: <MonitorSmartphone size={15} /> },
                { value: 'dark', label: 'داكن', icon: <MoonStar size={15} /> },
                { value: 'light', label: 'فاتح', icon: <SunMedium size={15} /> },
              ]}
            />
          </Row>
          <Row label="لون التطبيق">
            <div className="flex gap-2.5" role="radiogroup" aria-label="لون التطبيق">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={settings.accent === a}
                  aria-label={ACCENT_META[a].label}
                  data-tip={ACCENT_META[a].label}
                  onClick={() => void updateSettings({ accent: a })}
                  className={cn(
                    'grid size-10 place-items-center rounded-full transition-transform active:scale-90',
                    settings.accent === a &&
                      'ring-2 ring-ink ring-offset-2 ring-offset-[var(--bg)]',
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT_META[a].from}, ${ACCENT_META[a].to})`,
                  }}
                >
                  {settings.accent === a && (
                    <Check size={18} className="text-white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </Row>
          <Row label="الاحتفالات" hint="قصاصات ملوّنة عند النشر والفكرة النارية والمستوى الجديد">
            <Switch
              label="الاحتفالات"
              checked={settings.celebrations}
              onChange={(celebrations) => void updateSettings({ celebrations })}
            />
          </Row>
          <Row label="الاهتزاز عند اللمس" hint="على الأجهزة اللي تدعمه">
            <Switch
              label="الاهتزاز عند اللمس"
              checked={settings.haptics}
              onChange={(haptics) => void updateSettings({ haptics })}
            />
          </Row>
        </Section>

        <Section
          icon={Layers}
          title="النشر"
          description="المنصات والهدف وسرعة الكلام"
          from="#38bdf8"
          to="#4f46e5"
        >
          <Row label="المنصات">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = settings.platforms.includes(p);
                return (
                  <Chip
                    key={p}
                    selected={on}
                    icon={<PlatformIcon id={p} size={15} />}
                    onClick={() => {
                      const next = on
                        ? settings.platforms.filter((x) => x !== p)
                        : [...settings.platforms, p];
                      if (next.length === 0) {
                        toast({ title: 'لازم منصة وحدة على الأقل' });
                        return;
                      }
                      void updateSettings({ platforms: PLATFORMS.filter((x) => next.includes(x)) });
                    }}
                  >
                    {PLATFORM_META[p].label}
                  </Chip>
                );
              })}
            </div>
          </Row>
          <Row label="هدف النشر الأسبوعي" hint="كم محتوى بالأسبوع">
            <div className="flex items-center gap-2">
              <IconButton
                label="تقليل"
                variant="secondary"
                size="sm"
                onClick={() =>
                  void updateSettings({ weeklyGoal: Math.max(1, settings.weeklyGoal - 1) })
                }
              >
                <Minus size={16} />
              </IconButton>
              <span className="w-8 text-center font-display text-xl font-bold text-ink">
                {settings.weeklyGoal}
              </span>
              <IconButton
                label="زيادة"
                variant="secondary"
                size="sm"
                onClick={() =>
                  void updateSettings({ weeklyGoal: Math.min(21, settings.weeklyGoal + 1) })
                }
              >
                <Plus size={16} />
              </IconButton>
            </div>
          </Row>
          <Row label="أول يوم بالأسبوع">
            <Segmented
              size="sm"
              label="أول يوم بالأسبوع"
              value={String(settings.weekStartsOn) as '0' | '1' | '6'}
              onChange={(v) => void updateSettings({ weekStartsOn: Number(v) as 0 | 1 | 6 })}
              options={[
                { value: '6', label: 'السبت' },
                { value: '0', label: 'الأحد' },
                { value: '1', label: 'الاثنين' },
              ]}
            />
          </Row>
          <Row label="سرعة الكلام" hint="تُستخدم لحساب مدة السكريبت">
            <label className="flex items-center gap-3">
              <input
                type="range"
                min={100}
                max={200}
                step={5}
                value={settings.wordsPerMinute}
                onChange={(e) => void updateSettings({ wordsPerMinute: Number(e.target.value) })}
                aria-label="كلمة بالدقيقة"
                className="w-36 accent-[var(--accent)]"
              />
              <span className="w-20 text-sm text-ink-2">
                <span className="num">{settings.wordsPerMinute}</span> كلمة/د
              </span>
            </label>
          </Row>
        </Section>

        <PillarsSection pillars={pillars} />

        <InstallSection />

        <Section
          id="data"
          icon={ShieldCheck}
          title="البيانات والحماية"
          description="كل شي محفوظ على جهازك، ومحمي بنسخ تلقائية"
          from="#34d399"
          to="#0d9488"
        >
          {demo && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-warn/10 p-3 ps-4">
              <FlaskConical size={18} className="shrink-0 text-warn" aria-hidden />
              <p className="min-w-0 flex-1 text-sm text-ink-2">البيانات الحالية تجريبية</p>
              <Button
                variant="primary"
                size="sm"
                icon={<RotateCcw size={15} />}
                onClick={() => setFreshOpen(true)}
              >
                البدء من الصفر
              </Button>
            </div>
          )}
          <StorageStatus ideas={counts.ideas} stats={counts.stats} />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button
              variant="secondary"
              icon={<Download size={17} />}
              onClick={() => void exportNow()}
            >
              تصدير نسخة
            </Button>
            <Button
              variant="secondary"
              icon={<Upload size={17} />}
              onClick={() => fileRef.current?.click()}
            >
              استيراد نسخة
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = '';
              }}
            />
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
                <History size={16} /> النسخ التلقائية
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const snap = await takeSnapshot('manual');
                  toast(
                    snap
                      ? { title: 'انحفظت نسخة', tone: 'success' }
                      : { title: 'ما في بيانات للنسخ' },
                  );
                }}
              >
                نسخة الحين
              </Button>
            </div>
            {snapshots.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-3">
                أول نسخة تلقائية تنحفظ بكرة
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {snapshots.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{REASONS[s.reason]}</p>
                      <p className="text-xs text-ink-3">
                        {formatDate.dateTime(new Date(s.at))} · {plural(s.counts.ideas, WORDS.idea)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RotateCcw size={15} />}
                      onClick={() =>
                        setConfirm({
                          title: 'استرجاع هالنسخة؟',
                          description:
                            'البيانات الحالية بتتبدل بهالنسخة. قبلها ناخذ نسخة من الحالي احتياط.',
                          action: 'استرجاع',
                          run: async () => {
                            await restoreSnapshot(s.id!);
                            toast({ title: 'رجعت النسخة', tone: 'success' });
                          },
                        })
                      }
                    >
                      استرجاع
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-xs text-ink-3">البداية من جديد بدون أي بيانات</p>
            <Button
              variant="danger"
              icon={<Trash2 size={17} />}
              onClick={() =>
                setConfirm({
                  title: 'مسح كل البيانات؟',
                  description:
                    'بتنمسح كل الأفكار والأرقام والإعدادات، وبترجع لشاشة البداية. تبقى نسخة احتياطية في «النسخ التلقائية».',
                  action: 'مسح الكل',
                  danger: true,
                  run: startFresh,
                })
              }
            >
              مسح الكل
            </Button>
          </div>
        </Section>

        <Section
          icon={Bug}
          title="التشخيص"
          description="متتبع الأخطاء، محفوظ على جهازك فقط"
          from="#f59e0b"
          to="#ef4444"
        >
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-surface-2 px-3 py-1.5 text-ink-2">
              الإصدار <span className="num">{__APP_VERSION__}</span>
            </span>
            <span className="rounded-full bg-surface-2 px-3 py-1.5 text-ink-2">
              البناء {formatDate.dateTime(new Date(__BUILD_TIME__))}
            </span>
            <span
              className={cn(
                'rounded-full px-3 py-1.5',
                errors.length === 0 ? 'bg-good/12 text-good' : 'bg-warn/12 text-warn',
              )}
            >
              {errors.length === 0 ? 'ما في أخطاء ✓' : `${errors.length} خطأ مسجل`}
            </span>
          </div>
          {errors.length > 0 && (
            <>
              <ul className="mt-4 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {errors.map((e) => (
                  <li key={e.id} className="rounded-xl border border-line bg-surface p-3">
                    <p className="line-clamp-2 text-sm font-medium text-ink" dir="auto">
                      {e.message}
                    </p>
                    <p className="mt-1 text-xs text-ink-3">
                      {formatDate.dateTime(new Date(e.at))} · {e.source} · {e.route || '/'}
                      {e.count > 1 && ` · تكرر ${formatNumber(e.count)} مرة`}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download size={15} />}
                  onClick={() => downloadJson(`kawalees-errors-${todayKey()}.json`, errors)}
                >
                  تصدير السجل
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void db.errors.clear()}>
                  مسح السجل
                </Button>
              </div>
            </>
          )}
        </Section>
      </div>

      <About />

      <Sheet
        open={confirm !== null}
        onClose={() => !busy && setConfirm(null)}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        initialFocus="none"
        footer={
          <div className="flex gap-2.5">
            <Button
              variant={confirm?.danger ? 'danger' : 'primary'}
              size="lg"
              className="flex-1"
              disabled={busy}
              onClick={() => confirm && void run(confirm)}
            >
              {confirm?.action}
            </Button>
            <Button variant="secondary" size="lg" disabled={busy} onClick={() => setConfirm(null)}>
              إلغاء
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
          <ShieldCheck size={20} className="shrink-0 text-good" />
          الحارس ياخذ نسخة احتياطية قبل أي تغيير كبير
        </div>
      </Sheet>
    </Page>
  );
}

function StorageStatus({ ideas, stats }: { ideas: number; stats: number }) {
  const [info, setInfo] = useState<{ persisted: boolean; usage: number | null }>({
    persisted: false,
    usage: null,
  });
  useEffect(() => {
    let alive = true;
    void (async () => {
      const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
      const est = await navigator.storage?.estimate?.().catch(() => null);
      if (alive) setInfo({ persisted, usage: est?.usage ?? null });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Metric
        icon={<HardDrive size={16} />}
        label="الحجم"
        value={info.usage == null ? '—' : `${(info.usage / 1024 / 1024).toFixed(1)} MB`}
      />
      <Metric
        icon={<Layers size={16} />}
        label="المحتوى"
        value={`${formatNumber(ideas)} فكرة · ${formatNumber(stats)} رقم`}
      />
      <Metric
        icon={<ShieldCheck size={16} />}
        label="حماية التخزين"
        value={
          <span className={info.persisted ? 'text-good' : 'text-ink-2'}>
            {info.persisted ? 'مفعّلة' : 'عادية'}
          </span>
        }
      />
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 text-xs text-ink-3">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink" dir="auto">
        {value}
      </p>
    </div>
  );
}

function PillarsSection({ pillars }: { pillars: { id: string; name: string; emoji: string }[] }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const add = async () => {
    const clean = name.trim();
    if (!clean) return;
    await savePillar({ name: clean, emoji: emoji.trim() || '🎯' });
    setName('');
  };
  return (
    <Section
      icon={Palette}
      title="محاور المحتوى"
      description="المواضيع الرئيسية اللي تدور عليها أفكارك"
      from="#fb7185"
      to="#e11d48"
    >
      <ul className="flex flex-col gap-2">
        {pillars.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Input
              defaultValue={p.emoji}
              aria-label="رمز المحور"
              maxLength={4}
              className="h-11 w-14 px-0 text-center text-lg"
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== p.emoji &&
                void savePillar({ id: p.id, name: p.name, emoji: e.target.value.trim() })
              }
            />
            <Input
              defaultValue={p.name}
              aria-label="اسم المحور"
              maxLength={40}
              className="h-11"
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== p.name &&
                void savePillar({ id: p.id, name: e.target.value.trim(), emoji: p.emoji })
              }
            />
            <IconButton label={`حذف ${p.name}`} onClick={() => void deletePillar(p.id)}>
              <Trash2 size={17} />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          aria-label="رمز المحور الجديد"
          maxLength={4}
          className="h-11 w-14 px-0 text-center text-lg"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="محور جديد"
          aria-label="اسم المحور الجديد"
          maxLength={40}
          className="h-11"
        />
        <IconButton label="إضافة محور" variant="primary" type="submit" disabled={!name.trim()}>
          <Plus size={18} />
        </IconButton>
      </form>
    </Section>
  );
}

function InstallSection() {
  return (
    <Section
      id="install"
      icon={Smartphone}
      title="تثبيت التطبيق"
      description="على الجوال والآيباد والكمبيوتر، ويشتغل بدون نت"
      from="#60a5fa"
      to="#2563eb"
    >
      <InstallGuide compact />
    </Section>
  );
}

/* About: who made كواليس, the version, privacy in one line, and the official links. */
function About() {
  const links = [
    { href: LINKS.home, label: 'صفحة البرنامج' },
    { href: LINKS.releases, label: 'آخر إصدار' },
    { href: LINKS.license, label: 'الرخصة' },
  ];
  return (
    <section
      aria-labelledby="about-title"
      className="mt-10 flex flex-col items-center gap-4 rounded-[28px] border border-line bg-surface/60 px-6 py-9 text-center shadow-elev-1"
    >
      <LogoMark size={64} />
      <div className="flex flex-col items-center gap-1">
        <h2 id="about-title" className="font-display text-2xl font-semibold text-ink">
          حول كواليس
        </h2>
        <p className="text-sm text-ink-3">
          استوديو صانع المحتوى · الإصدار <span className="num">{__APP_VERSION__}</span>
        </p>
      </div>
      <p dir="ltr" className="font-display text-lg font-semibold text-ink">
        By: <span className="text-gradient">{AUTHOR}</span>
      </p>
      <p className="max-w-md text-sm leading-6 text-ink-2">
        كل البيانات محفوظة على هالجهاز فقط. ما في حسابات، ولا إعلانات، ولا تتبع.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            data-ripple
            className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {l.label}
          </a>
        ))}
      </div>
      <p className="text-xs text-ink-3">
        <span dir="ltr">{COPYRIGHT}</span> · جميع الحقوق محفوظة
      </p>
    </section>
  );
}
