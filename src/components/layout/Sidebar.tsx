// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { Command, Plus, Settings as SettingsIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router';
import { useLevel } from '@/hooks/useProgress';
import { useSettings } from '@/hooks/data';
import { cn } from '@/lib/cn';
import { useUI } from '@/store/ui';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Field';
import { GlyphTile } from '../ui/GlyphTile';
import { LogoMark, Wordmark } from '../ui/Logo';
import { ProgressBar } from '../ui/ProgressRing';
import { NAV } from './nav';

/* Desktop: full sidebar. Tablet: a compact rail. Both sit on the start (right) edge. */

export function Sidebar({ compact }: { compact: boolean }) {
  const openCapture = useUI((s) => s.openCapture);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  const settings = useSettings();
  const level = useLevel();

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-dvh shrink-0 flex-col border-e border-line bg-bg-2/60 backdrop-blur-xl',
        compact ? 'w-[88px] items-center px-2 py-5' : 'w-[272px] px-4 py-6',
      )}
      aria-label="التنقل الرئيسي"
    >
      <NavLink to="/" className="mb-7 rounded-2xl px-2" aria-label="كواليس — الرئيسية">
        {compact ? <LogoMark size={40} /> : <Wordmark />}
      </NavLink>

      {compact ? (
        <button
          type="button"
          onClick={() => openCapture()}
          aria-label="فكرة جديدة"
          data-tip="فكرة جديدة (N)"
          data-ripple
          className="mb-6 grid size-12 place-items-center rounded-2xl bg-accent-gradient-strong text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_10px_28px_-12px_var(--accent)] transition-transform active:scale-90"
        >
          <Plus size={22} strokeWidth={2.4} />
        </button>
      ) : (
        <Button
          variant="primary"
          size="lg"
          block
          className="mb-3"
          data-tip="فكرة جديدة (N)"
          icon={<Plus size={20} strokeWidth={2.4} />}
          onClick={() => openCapture()}
        >
          فكرة جديدة
        </Button>
      )}

      {!compact && (
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mb-6 flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm text-ink-3 transition-colors hover:border-line-2 hover:text-ink-2"
        >
          <Command size={15} />
          <span>بحث وأوامر</span>
          <span className="ms-auto flex gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      )}

      <nav className={cn('flex flex-col gap-1', compact && 'items-center gap-2')}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            data-ripple
            data-tip={compact ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center rounded-2xl transition-colors',
                compact ? 'size-14 flex-col justify-center gap-1' : 'h-12 gap-3 px-2.5',
                isActive ? 'text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId={compact ? 'rail-active' : 'side-active'}
                    className="absolute inset-0 -z-10 rounded-2xl border border-line bg-surface-2"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                {compact ? (
                  <>
                    <item.icon
                      size={22}
                      strokeWidth={isActive ? 2.2 : 1.8}
                      className={isActive ? 'text-accent-ink' : ''}
                    />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </>
                ) : (
                  <>
                    <GlyphTile icon={item.icon} from={item.from} to={item.toColor} size="sm" />
                    <span className="text-[15px] font-medium">{item.label}</span>
                    <span className="ms-auto hidden opacity-0 transition-opacity group-hover:opacity-100 xl:inline-flex">
                      <Kbd>{item.shortcut}</Kbd>
                    </span>
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={cn('mt-auto flex flex-col gap-3', compact && 'items-center')}>
        {!compact && (
          <NavLink
            to="/stats"
            className="glass block rounded-2xl p-4 transition-colors hover:border-line-2"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                {level.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">المستوى {level.level}</p>
                <p className="font-display text-base font-semibold text-ink">{level.title}</p>
              </div>
              <span className="text-xs font-medium text-ink-3">
                <span className="num">
                  {level.xp - level.floor}/{level.ceil - level.floor}
                </span>
              </span>
            </div>
            <ProgressBar value={level.progress} label="التقدم للمستوى التالي" className="mt-3" />
          </NavLink>
        )}
        <NavLink
          to="/settings"
          data-ripple
          data-tip={compact ? 'الإعدادات' : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-2xl transition-colors',
              compact ? 'size-14 flex-col justify-center gap-1' : 'h-12 gap-3 px-2.5',
              isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
            )
          }
        >
          {compact ? (
            <>
              <span className="text-xl" aria-hidden>
                {settings.avatar}
              </span>
              <span className="text-[10px] font-medium">الإعدادات</span>
            </>
          ) : (
            <>
              <span
                className="grid size-8 place-items-center rounded-full bg-surface-3 text-base"
                aria-hidden
              >
                {settings.avatar}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                {settings.name || 'الإعدادات'}
              </span>
              <SettingsIcon size={17} className="text-ink-3" />
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
