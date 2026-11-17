// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { ChevronDown, ClipboardCopy, Download, LifeBuoy, LockKeyhole, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { PRIVACY_NOTE, TELEGRAM_URL } from '@/lib/about';
import { trackError } from '@/lib/tracker';
import { toast, useUI } from '@/store/ui';
import { copyErrorLog } from './copyErrorLog';
import { FAQ, type Faq } from './faq';

/* Help and support, one sheet from Settings (or from anywhere through the UI store): the ten
   questions people ask, what happens to their data, how to reach support and how to send the
   error log. */

export function HelpSheet() {
  const open = useUI((s) => s.helpOpen);
  const setOpen = useUI((s) => s.setHelpOpen);
  const setInstallOpen = useUI((s) => s.setInstallOpen);

  const act = async (action: NonNullable<Faq['action']>) => {
    if (action === 'install') {
      setOpen(false);
      setInstallOpen(true);
      return;
    }
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
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title="المساعدة والدعم"
      description="إجابات سريعة، وطريقة التواصل عند الحاجة"
      size="lg"
      initialFocus="none"
    >
      <div className="flex flex-col gap-7">
        <section aria-labelledby="faq-title">
          <h3
            id="faq-title"
            className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink"
          >
            <LifeBuoy size={18} className="text-accent-ink" aria-hidden /> الأسئلة الشائعة
          </h3>
          <ul className="flex flex-col gap-2">
            {FAQ.map((f) => (
              <li key={f.id}>
                <details className="group rounded-2xl border border-line bg-surface open:bg-surface-2">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown
                      size={18}
                      className="shrink-0 text-ink-3 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="px-4 pb-4">
                    <p className="text-sm leading-7 text-ink-2">{f.a}</p>
                    {f.action && (
                      <Button
                        variant="tonal"
                        size="sm"
                        className="mt-3"
                        icon={<Download size={15} />}
                        onClick={() => void act(f.action!)}
                      >
                        {f.action === 'install' ? 'طريقة التثبيت' : 'تصدير نسخة الآن'}
                      </Button>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="privacy-title" className="rounded-2xl bg-surface-2 p-4">
          <h3
            id="privacy-title"
            className="mb-2 flex items-center gap-2 font-display text-base font-semibold text-ink"
          >
            <LockKeyhole size={18} className="text-good" aria-hidden /> الخصوصية
          </h3>
          <p className="text-sm leading-7 text-ink-2">{PRIVACY_NOTE}</p>
          <p className="mt-2 text-sm leading-7 text-ink-3">
            سجل الأخطاء محفوظ على الجهاز، ولا يغادره إلا إذا اختير نسخه وإرساله.
          </p>
        </section>

        <section aria-labelledby="contact-title">
          <h3
            id="contact-title"
            className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink"
          >
            <Send size={18} className="text-accent-ink" aria-hidden /> التواصل والإبلاغ
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {TELEGRAM_URL && (
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noreferrer"
                data-ripple
                className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-accent-gradient-strong px-5 text-[15px] font-semibold text-white"
              >
                <Send size={17} aria-hidden /> قناة الدعم
              </a>
            )}
            <Button
              variant="secondary"
              icon={<ClipboardCopy size={17} />}
              onClick={() => void copyErrorLog()}
            >
              نسخ سجل الأخطاء
            </Button>
          </div>
        </section>
      </div>
    </Sheet>
  );
}
