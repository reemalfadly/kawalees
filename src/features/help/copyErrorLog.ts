// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { buildErrorReport, copyText, trackError } from '@/lib/tracker';
import { toast } from '@/store/ui';

/* Copies the technical error log (no ideas, no numbers) so it can be pasted into a message to support. */

export async function copyErrorLog(): Promise<void> {
  try {
    const ok = await copyText(await buildErrorReport());
    toast(
      ok
        ? { title: 'نُسخ سجل الأخطاء', description: 'يمكن لصقه في رسالة الدعم', tone: 'success' }
        : { title: 'تعذّر النسخ', description: 'يمكن تصدير السجل من «التشخيص»', tone: 'error' },
    );
  } catch (e) {
    void trackError(e);
    toast({ title: 'تعذّر النسخ', tone: 'error' });
  }
}
