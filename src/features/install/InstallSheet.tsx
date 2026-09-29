import { Sheet } from '@/components/ui/Sheet';
import { useUI } from '@/store/ui';
import { InstallGuide } from './InstallGuide';

export function InstallSheet() {
  const open = useUI((s) => s.installOpen);
  const setOpen = useUI((s) => s.setInstallOpen);
  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title="تثبيت كواليس على الجهاز"
      description="يفتح من الشاشة الرئيسية مثل أي تطبيق، ويشتغل بدون إنترنت"
      size="lg"
      initialFocus="none"
    >
      <InstallGuide />
    </Sheet>
  );
}
