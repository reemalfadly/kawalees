// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { haptics } from '@/lib/haptics';
import { requestMove } from '@/features/gate/moves';
import { deleteIdea, duplicateIdea, restoreIdea, updateIdea } from '@/lib/repo';
import type { Idea, Stage } from '@/lib/types';
import { toast } from '@/store/ui';

/* Shared idea actions with the same feedback everywhere: haptics, toasts,
   confetti on publish, and undo for anything destructive. */
export function useIdeaActions() {
  const navigate = useNavigate();

  // Forward moves open the checkpoint; backward moves are free. Nothing moves without the repo.
  const moveTo = useCallback((idea: Idea, stage: Stage) => requestMove(idea, stage), []);

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
