import { Download, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';
import { useUI } from '@/store/ui';
import { useInstall } from './useInstall';

/* A quiet invitation on Home for anyone still using كواليس in a browser tab.
   Dismissing it keeps it away for two weeks. */

const KEY = 'kawalees:install-dismissed';
const SNOOZE = 14 * 86_400_000;

function snoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < SNOOZE;
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const { installed, canPrompt, prompt } = useInstall();
  const setInstallOpen = useUI((s) => s.setInstallOpen);
  const [hidden, setHidden] = useState(snoozed);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence initial={false}>
      {!installed && !hidden && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-[22px] p-3 ps-4 md:mb-5">
            <LogoMark size={40} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">كواليس أحلى كتطبيق على جهازك</p>
              <p className="text-xs text-ink-3">
                يفتح بضغطة من الشاشة الرئيسية، ويشتغل بدون إنترنت
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="primary"
                size="sm"
                icon={<Download size={16} />}
                onClick={() => (canPrompt ? void prompt() : setInstallOpen(true))}
              >
                تثبيت
              </Button>
              {canPrompt && (
                <Button variant="ghost" size="sm" onClick={() => setInstallOpen(true)}>
                  الطريقة
                </Button>
              )}
              <IconButton label="إخفاء" size="sm" onClick={dismiss}>
                <X size={16} />
              </IconButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
