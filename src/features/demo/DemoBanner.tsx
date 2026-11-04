// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { FlaskConical, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { GlyphTile } from '@/components/ui/GlyphTile';
import { isDemoData } from '@/lib/seed';
import type { Idea } from '@/lib/types';
import { useUI } from '@/store/ui';

/* Shown on Home while the sample ideas are loaded, so it is always clear the
   data isn't real and one tap leads back to a clean start. Hiding it keeps it
   away for three days; the command palette and Settings still offer the reset. */

const KEY = 'kawalees:demo-dismissed';
const SNOOZE = 3 * 86_400_000;

function snoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < SNOOZE;
  } catch {
    return false;
  }
}

export function DemoBanner({ ideas }: { ideas: readonly Idea[] }) {
  const setFreshOpen = useUI((s) => s.setFreshOpen);
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
      {!hidden && isDemoData(ideas) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-[22px] p-3 ps-4 md:mb-5">
            <GlyphTile icon={FlaskConical} from="#fbbf24" to="#f97316" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">هذي بيانات تجريبية</p>
              <p className="text-xs text-ink-3">للتجربة والاستكشاف. البداية الحقيقية بضغطة وحدة</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="primary"
                size="sm"
                icon={<RotateCcw size={16} />}
                onClick={() => setFreshOpen(true)}
              >
                البدء من الصفر
              </Button>
              <IconButton label="إخفاء تنبيه البيانات التجريبية" size="sm" onClick={dismiss}>
                <X size={16} />
              </IconButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
