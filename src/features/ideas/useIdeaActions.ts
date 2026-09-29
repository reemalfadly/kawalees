import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { STAGE_META } from '@/lib/catalog';
import { haptics } from '@/lib/haptics';
import { deleteIdea, duplicateIdea, restoreIdea, setStage, updateIdea } from '@/lib/repo';
import type { Idea, Stage } from '@/lib/types';
import { toast, useUI } from '@/store/ui';

/* Shared idea actions with the same feedback everywhere: haptics, toasts,
   confetti on publish, and undo for anything destructive. */
export function useIdeaActions() {
  const navigate = useNavigate();
  const celebrate = useUI((s) => s.celebrate);

  const moveTo = useCallback(
    async (idea: Idea, stage: Stage) => {
      if (idea.stage === stage) return;
      const previous = idea.stage;
      await setStage(idea.id, stage);
      if (stage === 'published') {
        celebrate();
        haptics.success();
        toast({
          title: 'نزل للعالم 🚀',
          description: idea.title,
          tone: 'success',
          action: { label: 'تراجع', run: () => void setStage(idea.id, previous) },
        });
      } else {
        haptics.tap();
        toast({
          title: `انتقلت إلى «${STAGE_META[stage].label}»`,
          action: { label: 'تراجع', run: () => void setStage(idea.id, previous) },
        });
      }
    },
    [celebrate],
  );

  const remove = useCallback(async (idea: Idea, after?: () => void) => {
    const removed = await deleteIdea(idea.id);
    haptics.warn();
    after?.();
    if (removed)
      toast({
        title: 'انحذفت الفكرة',
        description: removed.title,
        action: { label: 'تراجع', run: () => void restoreIdea(removed) },
      });
  }, []);

  const duplicate = useCallback(
    async (idea: Idea) => {
      const copy = await duplicateIdea(idea.id);
      if (copy)
        toast({
          title: 'انعملت نسخة',
          tone: 'success',
          action: { label: 'فتح', run: () => navigate(`/idea/${copy.id}`) },
        });
    },
    [navigate],
  );

  const toggleArchive = useCallback(async (idea: Idea) => {
    await updateIdea(idea.id, { archived: !idea.archived });
    toast({
      title: idea.archived ? 'رجعت من الأرشيف' : 'انتقلت للأرشيف',
      action: { label: 'تراجع', run: () => void updateIdea(idea.id, { archived: idea.archived }) },
    });
  }, []);

  return { moveTo, remove, duplicate, toggleArchive };
}
