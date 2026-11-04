// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { motion } from 'motion/react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { CommandPalette } from '@/features/palette/CommandPalette';
import { QuickCapture } from '@/features/capture/QuickCapture';
import { useIsDesktop, useIsTablet } from '@/hooks/useMediaQuery';
import { useLevel } from '@/hooks/useProgress';
import { haptics } from '@/lib/haptics';
import { isModalOpen } from '@/lib/modal';
import { toast, useUI } from '@/store/ui';
import { Confetti } from '../ui/Confetti';
import { Toaster } from '../ui/Toaster';
import { ErrorBoundary } from './ErrorBoundary';
import { NAV } from './nav';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Keyboard shortcuts for iPad keyboards and desktops. */
function useShortcuts() {
  const navigate = useNavigate();
  const openCapture = useUI((s) => s.openCapture);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!useUI.getState().paletteOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const state = useUI.getState();
      if (state.capture.open || state.paletteOpen || isModalOpen()) return;
      const key = e.key.toLowerCase();
      if (key === 'n' || key === 'ى') {
        e.preventDefault();
        openCapture();
      } else if (key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      } else {
        const item = NAV.find((n) => n.shortcut === key);
        if (item) navigate(item.to);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, openCapture, setPaletteOpen]);
}

const LEVEL_KEY = 'kawalees:level-seen';

/** Celebrates a level-up once, remembering the highest level already shown.
    Changes in the first seconds after launch are data loading in, not progress. */
function LevelWatcher() {
  const level = useLevel();
  const celebrate = useUI((s) => s.celebrate);
  const [mountedAt] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let seen: number;
      try {
        seen = Number(localStorage.getItem(LEVEL_KEY) ?? 0);
        if (level.level > seen) localStorage.setItem(LEVEL_KEY, String(level.level));
      } catch {
        return;
      }
      if (level.level <= seen || seen === 0 || Date.now() - mountedAt < 2500) return;
      celebrate();
      haptics.success();
      toast({
        title: `مستوى جديد: ${level.title} ${level.emoji}`,
        description: `وصلت المستوى ${level.level}`,
        tone: 'success',
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [level.level, level.title, level.emoji, celebrate, mountedAt]);
  return null;
}

/** Handles ?capture=1 from the home-screen shortcut. */
function CaptureDeepLink() {
  const [params, setParams] = useSearchParams();
  const openCapture = useUI((s) => s.openCapture);
  useEffect(() => {
    if (params.get('capture') !== '1') return;
    openCapture();
    params.delete('capture');
    setParams(params, { replace: true });
  }, [params, setParams, openCapture]);
  return null;
}

export function AppShell() {
  const tablet = useIsTablet();
  const desktop = useIsDesktop();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useShortcuts();

  // New screen: start at the top and move focus for screen readers.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[90] focus:rounded-xl focus:bg-solid focus:px-4 focus:py-2"
      >
        تخطّي إلى المحتوى
      </a>
      {tablet && <Sidebar compact={!desktop} />}
      <main
        ref={mainRef}
        id="main"
        tabIndex={-1}
        className="min-w-0 flex-1 pb-36 outline-none md:pb-16"
      >
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<RouteFallback />}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!tablet && <TabBar />}
      <QuickCapture />
      <CommandPalette />
      <Toaster />
      <Confetti />
      <LevelWatcher />
      <CaptureDeepLink />
    </div>
  );
}

export function RouteFallback() {
  return (
    <div
      className="mx-auto max-w-[1180px] px-4 pt-12 md:px-8"
      aria-busy="true"
      aria-label="جاري التحميل"
    >
      <div className="h-9 w-48 overflow-hidden rounded-xl bg-surface-2">
        <div className="shimmer h-full w-full" />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 overflow-hidden rounded-card bg-surface">
            <div className="shimmer h-full w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
