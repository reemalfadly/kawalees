// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { trackError } from '@/lib/tracker';
import { toast, useUI } from '@/store/ui';

/* The way out of the demo: clears the sample data and returns to the welcome
   screen so كواليس can be set up for real. A snapshot is taken first. */

export function StartFreshSheet() {
  const open = useUI((s) => s.freshOpen);
  const setOpen = useUI((s) => s.setFreshOpen);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { startFresh } = await import('@/lib/backup');
      await startFresh();
      navigate('/', { replace: true });
      setOpen(false);
    } catch (e) {
      void trackError(e);
      toast({
        title: 'صار خلل',
        description: e instanceof Error ? e.message : undefined,
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => !busy && setOpen(false)}
      title="البدء من الصفر؟"
      description="بتنمسح البيانات التجريبية كلها، ونرجع لشاشة البداية عشان نجهّز كواليس من جديد."
      initialFocus="none"
      footer={
        <div className="flex gap-2.5">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            icon={<RotateCcw size={18} />}
            disabled={busy}
            onClick={() => void run()}
          >
            البدء من الصفر
          </Button>
          <Button variant="secondary" size="lg" disabled={busy} onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
        <ShieldCheck size={20} className="shrink-0 text-good" />
        قبل المسح ناخذ نسخة احتياطية، وتبقى في «الإعدادات ← النسخ التلقائية»
      </div>
    </Sheet>
  );
}
