// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import {
  BarChart3,
  CalendarDays,
  CornerDownLeft,
  Download,
  House,
  Lightbulb,
  MoonStar,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  SunMedium,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { StageBadge } from '@/components/ui/StageBadge';
import { useLiveIdeas, useSettings } from '@/hooks/data';
import { cn } from '@/lib/cn';
import { isDemoData } from '@/lib/seed';
import { normalizeArabic } from '@/lib/text';
import { updateSettings } from '@/lib/repo';
import { useUI } from '@/store/ui';

/* ⌘K: jump anywhere, run any action, or find any idea by typing a few letters. */

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
  group: 'actions' | 'ideas';
  extra?: React.ReactNode;
}

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPaletteOpen);
  const openCapture = useUI((s) => s.openCapture);
  const ideas = useLiveIdeas();
  const settings = useSettings();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = () => {
    // Drop focus from the search box right away so it can't swallow keys while animating out.
    (document.activeElement as HTMLElement | null)?.blur();
    setOpen(false);
    setQuery('');
    setActive(0);
  };

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => navigate(path);
    const isDark = document.documentElement.dataset.theme === 'dark';
    const actions: Command[] = [
      {
        id: 'new',
        label: 'فكرة جديدة',
        hint: 'N',
        icon: Plus,
        run: () => openCapture(),
        group: 'actions',
      },
      { id: 'home', label: 'الرئيسية', hint: '1', icon: House, run: go('/'), group: 'actions' },
      {
        id: 'ideas',
        label: 'الأفكار',
        hint: '2',
        icon: Lightbulb,
        run: go('/ideas'),
        group: 'actions',
      },
      {
        id: 'board',
        label: 'لوحة المراحل',
        icon: Lightbulb,
        run: go('/ideas?view=board'),
        group: 'actions',
      },
      {
        id: 'calendar',
        label: 'التقويم',
        hint: '3',
        icon: CalendarDays,
        run: go('/calendar'),
        group: 'actions',
      },
      {
        id: 'stats',
        label: 'الأرقام والإنجازات',
        hint: '4',
        icon: BarChart3,
        run: go('/stats'),
        group: 'actions',
      },
      { id: 'recap', label: 'ملخص الشهر', icon: Sparkles, run: go('/recap'), group: 'actions' },
      {
        id: 'settings',
        label: 'الإعدادات',
        icon: Settings,
        run: go('/settings'),
        group: 'actions',
      },
      {
        id: 'install',
        label: 'تثبيت التطبيق على الجهاز',
        icon: Download,
        run: () => useUI.getState().setInstallOpen(true),
        group: 'actions',
      },
      {
        id: 'theme',
        label: isDark ? 'الوضع الفاتح' : 'الوضع الداكن',
        icon: isDark ? SunMedium : MoonStar,
        run: () => void updateSettings({ theme: isDark ? 'light' : 'dark' }),
        group: 'actions',
      },
    ];
    if (isDemoData(ideas)) {
      actions.push({
        id: 'fresh',
        label: 'البدء من الصفر (مسح البيانات التجريبية)',
        icon: RotateCcw,
        run: () => useUI.getState().setFreshOpen(true),
        group: 'actions',
      });
    }
    const ideaCommands: Command[] = [...ideas]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((i) => ({
        id: `idea-${i.id}`,
        label: i.title || 'بدون عنوان',
        icon: Lightbulb,
        run: go(`/idea/${i.id}`),
        group: 'ideas' as const,
        extra: <StageBadge stage={i.stage} />,
      }));
    return [...actions, ...ideaCommands];
    // settings.theme is read so the theme label refreshes after toggling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideas, navigate, openCapture, settings.theme]);

  const results = useMemo(() => {
    const q = normalizeArabic(query);
    if (!q)
      return commands
        .filter((c) => c.group === 'actions')
        .concat(commands.filter((c) => c.group === 'ideas').slice(0, 5));
    const terms = q.split(/\s+/);
    return commands
      .filter((c) => {
        const hay = normalizeArabic(c.label);
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 12);
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const runAt = (idx: number) => {
    const cmd = results[idx];
    if (!cmd) return;
    close();
    cmd.run();
  };

  const groups: { key: Command['group']; label: string }[] = [
    { key: 'actions', label: 'تنقّل وأوامر' },
    { key: 'ideas', label: 'الأفكار' },
  ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[max(1rem,env(safe-area-inset-top))] md:pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-scrim backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="البحث والأوامر"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', stiffness: 480, damping: 36 }}
            className="acrylic relative w-full max-w-xl overflow-hidden rounded-[24px] shadow-elev-4"
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                runAt(active);
              }
            }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={19} className="shrink-0 text-ink-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="بحث عن فكرة أو أمر…"
                aria-label="بحث"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
                className="h-15 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
              />
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-3 md:inline">
                Esc
              </kbd>
            </div>
            <div
              ref={listRef}
              id="palette-list"
              role="listbox"
              className="max-h-[min(60vh,420px)] overflow-y-auto p-2"
            >
              {results.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-ink-3">ما لقينا شي بهالاسم</p>
              )}
              {groups.map((g) => {
                const items = results
                  .map((c, i) => ({ c, i }))
                  .filter(({ c }) => c.group === g.key);
                if (items.length === 0) return null;
                return (
                  <div key={g.key} className="mb-1">
                    <p className="px-3 pt-2 pb-1.5 text-xs font-medium text-ink-3">{g.label}</p>
                    {items.map(({ c, i }) => (
                      <button
                        key={c.id}
                        id={`cmd-${c.id}`}
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        data-index={i}
                        onMouseMove={() => setActive(i)}
                        onClick={() => runAt(i)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors',
                          i === active ? 'bg-surface-3 text-ink' : 'text-ink-2',
                        )}
                      >
                        <c.icon
                          size={18}
                          className={i === active ? 'text-accent-ink' : 'text-ink-3'}
                        />
                        <span className="min-w-0 flex-1 truncate text-[15px]">{c.label}</span>
                        {c.extra}
                        {c.hint && (
                          <kbd className="rounded-md border border-line px-1.5 text-[11px] text-ink-3">
                            {c.hint}
                          </kbd>
                        )}
                        {i === active && <CornerDownLeft size={15} className="text-ink-3" />}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
