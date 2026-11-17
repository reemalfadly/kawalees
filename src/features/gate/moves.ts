// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { STAGE_META } from '@/lib/catalog';
import { isForwardMove, missingSummary } from '@/lib/gates';
import { haptics } from '@/lib/haptics';
import { moveIdeaStage, type MoveResult } from '@/lib/repo';
import type { Idea, Stage } from '@/lib/types';
import { toast, useUI } from '@/store/ui';
import { useGate } from './gateStore';

/* Every stage change goes through here.
   Forward: always opens the checkpoint (nothing moves forward without it).
   Backward: free, straight to the repo.
   A refused move never shows a success toast. */

/** Plain-language reason a move was refused. */
export function refusalText(result: MoveResult): string {
  if (result.error === 'not-found') return 'الفكرة لم تعد موجودة';
  return missingSummary(result.missing) || 'لم تُستوفَ شروط الانتقال';
}

/** The success feedback after a real move (confetti only for a real publish). */
export function announceMoved(idea: Pick<Idea, 'id' | 'title'>, to: Stage, previous: Stage): void {
  const undo = { label: 'تراجع', run: () => void undoMove(idea.id, previous, to) };
  if (to === 'published') {
    useUI.getState().celebrate();
    haptics.success();
    toast({ title: 'نزل للعالم', description: idea.title, tone: 'success', action: undo });
  } else {
    haptics.tap();
    toast({ title: `انتقلت إلى «${STAGE_META[to].label}»`, action: undo });
  }
}

/** Undo of a move: never silent. A refused undo says why and offers the checkpoint. */
export async function undoMove(ideaId: string, previous: Stage, from: Stage): Promise<void> {
  const result = await moveIdeaStage(ideaId, previous);
  if (result.ok) {
    haptics.tap();
    toast({ title: `رجعت إلى «${STAGE_META[previous].label}»` });
    return;
  }
  haptics.warn();
  const canOpen = result.error !== 'not-found' && isForwardMove(from, previous);
  toast({
    title: 'تعذّر التراجع',
    description: refusalText(result),
    tone: 'error',
    duration: 8000,
    action: canOpen
      ? { label: 'نقطة التفتيش', run: () => useGate.getState().open(ideaId, previous) }
      : undefined,
  });
}

/** The single entry point for moving an idea to `to`. */
export async function requestMove(idea: Idea, to: Stage): Promise<void> {
  if (idea.stage === to) return;
  if (isForwardMove(idea.stage, to)) {
    useGate.getState().open(idea.id, to);
    return;
  }
  const previous = idea.stage;
  const result = await moveIdeaStage(idea.id, to);
  if (!result.ok) {
    haptics.warn();
    toast({ title: 'لا يمكن النقل', description: refusalText(result), tone: 'error' });
    return;
  }
  announceMoved(idea, to, previous);
}
