// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { DatabaseBackup, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Page } from '@/components/layout/Page';
import { Button, IconButton } from '@/components/ui/Button';
import { GlyphTile } from '@/components/ui/GlyphTile';
import { db } from '@/lib/db';
import { plural, WORDS } from '@/lib/format';
import {
  daysSince,
  dismissExportReminder,
  exportReminderDue,
  getLastExportAt,
  getReminderDismissedAt,
} from '@/lib/protect';
import { isDemoData } from '@/lib/seed';
import { trackError } from '@/lib/tracker';
import { toast } from '@/store/ui';

/* A gentle weekly nudge to save a backup file. It appears in the app shell once a week has passed
   since the last export (or a day after the first idea when there has never been one), can be
   closed, and then stays away for two days. Exporting hides it for another week. */

export function ExportReminder() {
  // One live query for everything the decision needs; it re-runs when ideas or the device facts change.
  const state = useLiveQuery(async () => {
    const now = Date.now();
    const live = (await db.ideas.toArray()).filter((i) => !i.archived);
    const lastExportAt = await getLastExportAt();
    const due =
      !isDemoData(live) &&
      exportReminderDue({
        now,
        lastExportAt,
        oldestIdeaAt: live.length ? Math.min(...live.map((i) => i.createdAt)) : null,
        ideaCount: live.length,
        dismissedAt: await getReminderDismissedAt(),
      });
    return { due, days: lastExportAt === null ? null : daysSince(lastExportAt, now) };
  });
  const [busy, setBusy] = useState(false);
  const due = state?.due ?? false;
  const days = state?.days ?? null;

  const exportNow = async () => {
    setBusy(true);
    try {
      const { exportAndDownload } = await import('@/lib/backup');
      await exportAndDownload();
      toast({
        title: 'انحفظت النسخة الاحتياطية',
        description: 'الملف نزل على الجهاز',
        tone: 'success',
      });
    } catch (e) {
      void trackError(e);
      toast({ title: 'تعذّر التصدير', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence initial={false}>
      {due && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <Page className="pt-3">
            <div
              role="status"
              className="glass flex flex-wrap items-center gap-3 rounded-[22px] p-3 ps-4"
            >
              <GlyphTile icon={DatabaseBackup} from="#34d399" to="#0d9488" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  {days === null
                    ? 'لا توجد نسخة احتياطية بعد'
                    : `مضى ${plural(days, WORDS.day)} على آخر نسخة احتياطية`}
                </p>
                <p className="text-xs text-ink-3">ملف صغير يحفظ أفكارك لو ضاعت بيانات المتصفح</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void exportNow()}
                >
                  تصدير الآن
                </Button>
                <IconButton
                  label="إخفاء تذكير النسخة الاحتياطية"
                  size="sm"
                  onClick={() => void dismissExportReminder()}
                >
                  <X size={16} />
                </IconButton>
              </div>
            </div>
          </Page>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
