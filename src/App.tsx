// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { AppShell, RouteFallback } from '@/components/layout/AppShell';
import { Aurora } from '@/components/layout/Aurora';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { UpdatePrompt } from '@/components/layout/UpdatePrompt';
import { LogoMark } from '@/components/ui/Logo';
import { TooltipLayer } from '@/components/ui/TooltipLayer';
import { StartFreshSheet } from '@/features/demo/StartFreshSheet';
import { InstallSheet } from '@/features/install/InstallSheet';
import { useSettingsRecord } from '@/hooks/data';
import { useAppearance } from '@/hooks/useAppearance';
import { requestPersistentStorage } from '@/lib/db';
import { setHapticsEnabled } from '@/lib/haptics';
import { trackError } from '@/lib/tracker';

const HomePage = lazy(() => import('@/features/home/HomePage'));
const IdeasPage = lazy(() => import('@/features/ideas/IdeasPage'));
const IdeaPage = lazy(() => import('@/features/idea/IdeaPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const StatsPage = lazy(() => import('@/features/stats/StatsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const PrompterPage = lazy(() => import('@/features/prompter/PrompterPage'));
const RecapPage = lazy(() => import('@/features/recap/RecapPage'));
const Onboarding = lazy(() => import('@/features/onboarding/Onboarding'));
const NotFound = lazy(() => import('@/features/NotFound'));

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="جاري التحميل">
      <LogoMark size={64} className="animate-pulse" />
    </div>
  );
}

export function App() {
  const settings = useSettingsRecord();
  useAppearance(settings?.theme ?? 'system', settings?.accent ?? 'ember');
  useEffect(() => setHapticsEnabled(settings?.haptics !== false), [settings?.haptics]);

  useEffect(() => {
    void requestPersistentStorage();
    // The backup module (and its validator) loads after first paint.
    import('@/lib/backup')
      .then((m) => m.dailySnapshot())
      .catch((e) => void trackError(e, 'manual'));
  }, []);

  let content;
  if (settings === undefined) content = <Splash />;
  else if (!settings?.onboarded)
    content = (
      <Suspense fallback={<Splash />}>
        <Onboarding />
      </Suspense>
    );
  else
    content = (
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="ideas" element={<IdeasPage />} />
          <Route path="idea/:id" element={<IdeaPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route
          path="idea/:id/prompter"
          element={
            <Suspense fallback={<Splash />}>
              <PrompterPage />
            </Suspense>
          }
        />
        <Route
          path="recap"
          element={
            <Suspense fallback={<Splash />}>
              <RecapPage />
            </Suspense>
          }
        />
      </Routes>
    );

  return (
    <>
      <Aurora />
      <ErrorBoundary>{content ?? <RouteFallback />}</ErrorBoundary>
      {/* Registered at the root so even a first visit (still on onboarding) is cached for offline use. */}
      <UpdatePrompt />
      <TooltipLayer />
      <InstallSheet />
      <StartFreshSheet />
    </>
  );
}
