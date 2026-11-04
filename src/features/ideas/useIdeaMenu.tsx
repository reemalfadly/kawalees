// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { Archive, ArchiveRestore, ArrowLeft, Copy, Trash2 } from 'lucide-react';
import type { MenuItem } from '@/components/ui/Menu';
import { STAGE_META } from '@/lib/catalog';
import { nextStage } from '@/lib/stats';
import type { Idea } from '@/lib/types';
import { useIdeaActions } from './useIdeaActions';

export function useIdeaMenu(idea: Idea): MenuItem[] {
  const { moveTo, remove, duplicate, toggleArchive } = useIdeaActions();
  const next = nextStage(idea.stage);
  return [
    ...(next
      ? [
          {
            label: `نقل إلى «${STAGE_META[next].label}»`,
            icon: <ArrowLeft size={17} />,
            onSelect: () => void moveTo(idea, next),
          },
        ]
      : []),
    { label: 'نسخة مكررة', icon: <Copy size={17} />, onSelect: () => void duplicate(idea) },
    {
      label: idea.archived ? 'إرجاع من الأرشيف' : 'أرشفة',
      icon: idea.archived ? <ArchiveRestore size={17} /> : <Archive size={17} />,
      onSelect: () => void toggleArchive(idea),
    },
    { label: 'حذف', icon: <Trash2 size={17} />, danger: true, onSelect: () => void remove(idea) },
  ];
}
