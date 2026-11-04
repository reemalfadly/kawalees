// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '@/store/ui';
import { Button } from '../ui/Button';

/* Offline support + safe updates: a new version never replaces the running one
   mid-edit. It waits here until the user taps "update". */

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // Where service workers are blocked (private windows, some policies) the app still runs, just
    // without offline support, so that isn't recorded as an app error in Settings → Diagnostics.
    onRegisterError: (e) => console.warn('[kawalees] offline support unavailable:', e),
    onRegisteredSW: (_url, registration) => {
      // Check for a fresh version every hour while the app stays open.
      if (registration)
        setInterval(() => void registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    toast({
      title: 'جاهز بدون إنترنت',
      description: 'كواليس الحين يشتغل حتى لو انقطع النت',
      tone: 'success',
    });
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="glass-strong fixed inset-x-3 z-[65] mx-auto flex max-w-md items-center gap-3 rounded-2xl p-3 ps-4 bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] md:bottom-6"
          role="status"
        >
          <RefreshCw size={20} className="shrink-0 text-accent-ink" />
          <p className="flex-1 text-sm font-medium text-ink">نسخة جديدة من كواليس جاهزة</p>
          <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
            لاحقاً
          </Button>
          <Button variant="primary" size="sm" onClick={() => void updateServiceWorker(true)}>
            تحديث
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
