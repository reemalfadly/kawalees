// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import {
  AppWindow,
  ArrowLeftRight,
  Check,
  Download,
  EllipsisVertical,
  Laptop,
  Monitor,
  MonitorDown,
  Share,
  ShieldCheck,
  Smartphone,
  SquarePlus,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { GlyphTile } from '@/components/ui/GlyphTile';
import { Segmented } from '@/components/ui/Segmented';
import { OFFLINE_NOTE } from '@/lib/about';
import { detectPlatform, useInstall, type Platform } from './useInstall';

/* How to put كواليس on any device. Opens on the visitor's own platform, offers
   the browser's one-tap install where it exists, and spells out the manual
   steps everywhere else (Safari on iPhone and iPad has no install prompt). */

interface Step {
  icon: LucideIcon;
  text: ReactNode;
}

interface Guide {
  label: string;
  device: string;
  browser: string;
  icon: LucideIcon;
  from: string;
  to: string;
  steps: Step[];
  note?: ReactNode;
  /** A downloadable program for this platform, from the latest GitHub release. */
  download?: { file: string; label: string; extra?: { file: string; label: string } };
}

const RELEASES = 'https://github.com/reemalfadly/kawalees/releases/latest/download/';

const b = (t: string) => <b className="font-semibold text-ink">{t}</b>;

const GUIDES: Record<Platform, Guide> = {
  ios: {
    label: 'آيفون وآيباد',
    device: 'iPhone و iPad',
    browser: 'Safari',
    icon: Smartphone,
    from: '#60a5fa',
    to: '#2563eb',
    steps: [
      { icon: AppWindow, text: <>فتح رابط كواليس من متصفح {b('Safari')}</> },
      {
        icon: Share,
        text: <>الضغط على زر {b('المشاركة')} (مربع وسهم لفوق): في الآيفون تحت، وفي الآيباد فوق</>,
      },
      {
        icon: SquarePlus,
        text: (
          <>
            اختيار {b('«إضافة إلى الشاشة الرئيسية»')} ثم {b('«إضافة»')}
          </>
        ),
      },
      { icon: Check, text: <>تظهر أيقونة كواليس مع التطبيقات، وتفتح بشاشة كاملة دون المتصفح</> },
    ],
    note: (
      <>
        من iOS 16.4 فما فوق تصلح الخطوات نفسها من Chrome وEdge على الآيفون والآيباد. وفي Safari
        خصوصاً، قد تُنظَّف بيانات الموقع غير المثبّت إذا لم يُفتح أسبوعاً، فالتثبيت يحمي أفكارك.
      </>
    ),
  },
  android: {
    label: 'أندرويد',
    device: 'جوالات وتابلت أندرويد',
    browser: 'Chrome',
    download: { file: 'Kawalees-Android.apk', label: 'تحميل التطبيق لأندرويد (APK)' },
    icon: Smartphone,
    from: '#34d399',
    to: '#0d9488',
    steps: [
      { icon: AppWindow, text: <>فتح رابط كواليس من متصفح {b('Chrome')}</> },
      {
        icon: EllipsisVertical,
        text: <>يظهر اقتراح التثبيت في الأسفل، أو من القائمة {b('⋮')} في الأعلى</>,
      },
      {
        icon: Download,
        text: (
          <>
            اختيار {b('«تثبيت التطبيق»')} ثم {b('«تثبيت»')}
          </>
        ),
      },
      { icon: Check, text: <>يُضاف كواليس إلى قائمة التطبيقات والشاشة الرئيسية</> },
    ],
    note: <>في متصفحي Samsung Internet وEdge الخيار نفسه: القائمة ← «إضافة إلى الشاشة الرئيسية».</>,
  },
  windows: {
    label: 'ويندوز',
    device: 'ويندوز، ولينكس، وكروم بوك',
    browser: 'Edge أو Chrome',
    download: {
      file: 'Kawalees-Windows-Setup.exe',
      label: 'تحميل البرنامج لويندوز',
      extra: { file: 'Kawalees-Linux.AppImage', label: 'نسخة لينكس' },
    },
    icon: Monitor,
    from: '#38bdf8',
    to: '#4f46e5',
    steps: [
      {
        icon: AppWindow,
        text: (
          <>
            فتح رابط كواليس في {b('Microsoft Edge')} أو {b('Chrome')}
          </>
        ),
      },
      {
        icon: MonitorDown,
        text: <>الضغط على أيقونة التثبيت في شريط العنوان (شاشة فيها سهم)</>,
      },
      {
        icon: Download,
        text: (
          <>
            أو من القائمة (…) ← {b('التطبيقات')} ← {b('«تثبيت هذا الموقع كتطبيق»')}
          </>
        ),
      },
      {
        icon: Check,
        text: <>يظهر كواليس في قائمة ابدأ، ويُثبَّت على شريط المهام بنافذة خاصة به</>,
      },
    ],
  },
  mac: {
    label: 'ماك',
    device: 'MacBook و iMac',
    browser: 'Safari أو Chrome',
    download: { file: 'Kawalees-Mac.dmg', label: 'تحميل البرنامج للماك' },
    icon: Laptop,
    from: '#a78bfa',
    to: '#7c3aed',
    steps: [
      { icon: AppWindow, text: <>فتح رابط كواليس في {b('Safari')} (نظام Sonoma أو أحدث)</> },
      {
        icon: SquarePlus,
        text: (
          <>
            من قائمة {b('File')} اختيار {b('«Add to Dock»')}
          </>
        ),
      },
      {
        icon: MonitorDown,
        text: <>أو في Chrome و Edge: أيقونة التثبيت في شريط العنوان</>,
      },
      { icon: Check, text: <>يظهر كواليس في Dock وLaunchpad مثل أي تطبيق</> },
    ],
  },
};

const ORDER: Platform[] = ['ios', 'android', 'windows', 'mac'];

export function InstallGuide({ compact }: { compact?: boolean }) {
  const { canPrompt, installed, prompt } = useInstall();
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  const [mine] = useState<Platform>(detectPlatform);
  const guide = GUIDES[platform];

  return (
    <div className="flex flex-col gap-5">
      {installed ? (
        <div className="flex items-center gap-3 rounded-2xl bg-good/10 p-4 text-sm font-medium text-good">
          <Check size={20} /> كواليس مثبّت على هذا الجهاز
        </div>
      ) : (
        canPrompt && (
          <div className="flex flex-col gap-3 rounded-2xl bg-accent-softer p-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-ink-2">
              يمكن للمتصفح تثبيت كواليس مباشرة بضغطة واحدة
            </p>
            <Button variant="primary" icon={<Download size={18} />} onClick={() => void prompt()}>
              تثبيت كواليس
            </Button>
          </div>
        )
      )}

      <Segmented
        label="نوع الجهاز"
        value={platform}
        onChange={setPlatform}
        className="w-full"
        size="sm"
        options={ORDER.map((p) => ({
          value: p,
          label: (
            <span className="inline-flex items-center gap-1">
              {GUIDES[p].label}
              {p === mine && (
                <span className="size-1.5 rounded-full bg-accent" aria-label="جهازك" />
              )}
            </span>
          ),
        }))}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={platform}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <GlyphTile icon={guide.icon} from={guide.from} to={guide.to} />
            <div className="min-w-0">
              <p className="font-display text-base font-semibold text-ink">{guide.device}</p>
              <p className="text-xs text-ink-3">المتصفح: {guide.browser}</p>
            </div>
          </div>
          {guide.download && !__NATIVE__ && (
            <div className="flex flex-col gap-2 rounded-2xl border border-line p-4">
              <p className="text-sm text-ink-2">برنامج كامل يُنزَّل على الجهاز ويعمل دون متصفح:</p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={RELEASES + guide.download.file}
                  target="_blank"
                  rel="noreferrer"
                  data-ripple
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-accent-gradient px-4 text-sm font-semibold text-white shadow-elev-1"
                >
                  <Download size={18} /> {guide.download.label}
                </a>
                {guide.download.extra && (
                  <a
                    href={RELEASES + guide.download.extra.file}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-accent-ink hover:underline"
                  >
                    {guide.download.extra.label}
                  </a>
                )}
              </div>
              <p className="text-xs leading-5 text-ink-3">
                أو التثبيت من المتصفح بالخطوات التالية:
              </p>
            </div>
          )}
          <ol className="flex flex-col gap-2.5">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">
                  {i + 1}
                </span>
                <span className="flex-1 pt-0.5 text-sm leading-6 text-ink-2">{s.text}</span>
                <s.icon size={18} className="mt-1 shrink-0 text-ink-3" aria-hidden />
              </li>
            ))}
          </ol>
          {guide.note && <p className="text-xs leading-5 text-ink-3">{guide.note}</p>}
        </motion.div>
      </AnimatePresence>

      {!compact && (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          <li className="flex items-start gap-3 rounded-2xl border border-line p-3 text-sm leading-6 text-ink-2">
            <WifiOff size={18} className="mt-1 shrink-0 text-accent-ink" aria-hidden />
            <span>{OFFLINE_NOTE}. ويتحدث وحده عند نزول نسخة جديدة.</span>
          </li>
          <li className="flex items-start gap-3 rounded-2xl border border-line p-3 text-sm leading-6 text-ink-2 sm:col-span-2">
            <ShieldCheck size={18} className="mt-1 shrink-0 text-good" aria-hidden />
            <span>
              تثبيت التطبيق يحمي أفكارك من الضياع: بياناته أقل عرضة للتنظيف التلقائي، بينما قد
              تُنظَّف بيانات موقع غير مثبّت (خاصة في Safari).
            </span>
          </li>
          <li className="flex items-start gap-3 rounded-2xl border border-line p-3 text-sm leading-6 text-ink-2">
            <ArrowLeftRight size={18} className="mt-1 shrink-0 text-accent-ink" aria-hidden />
            <span>
              البيانات محفوظة على كل جهاز على حدة. للنقل: الإعدادات ← تصدير نسخة، ثم استيراد في
              الجهاز الثاني.
            </span>
          </li>
        </ul>
      )}
    </div>
  );
}
