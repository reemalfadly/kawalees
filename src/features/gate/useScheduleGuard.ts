// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Requirement } from '@/lib/gates';
import { haptics } from '@/lib/haptics';
import { scheduleIdea, type MoveResult } from '@/lib/repo';
import type { Idea } from '@/lib/types';
import { toast } from '@/store/ui';
import { useGate } from './gateStore';
import { joinPhrases } from './stageStatus';

/* A day on the calendar needs a real hook and script. When the repo refuses, say exactly what is
   missing and offer to open the idea at the first missing field. */

export function useScheduleGuard() {
  const navigate = useNavigate();
  const location = useLocation();

  /** Explain a refused schedule; the action opens the idea and focuses the first missing field. */
  const explainRefusal = useCallback(
    (
      idea: Pick<
        Idea,
        | 'id'
        | 'title'
        | 'hook'
        | 'body'
        | 'cta'
        | 'platforms'
        | 'format'
        | 'approvals'
        | 'proof'
        | 'publishedUrl'
        | 'scheduledFor'
        | 'stage'
      >,
      missing: Requirement[],
    ) => {
      haptics.warn();
      const first = missing.find((m) => m.field)?.field;
      toast({
        title: 'لا يمكن تحديد الموعد بعد',
        description: missing.length ? joinPhrases(idea, missing, 3) : 'تعذّر حفظ الموعد',
        tone: 'error',
        duration: 9000,
        action: {
          label: 'افتح الفكرة وأكملها',
          run: () => {
            if (location.pathname !== `/idea/${idea.id}`) navigate(`/idea/${idea.id}`);
            if (first) useGate.getState().requestFocus(idea.id, first);
          },
        },
      });
    },
    [navigate, location.pathname],
  );

  /** Try to put (or clear) a day. Returns true only when the repo really saved it. */
  const trySchedule = useCallback(
    async (idea: Idea, day: string | null, time: string | null): Promise<MoveResult> => {
      const result = await scheduleIdea(idea.id, day, time);
      if (!result.ok) {
        if (result.error === 'not-found') toast({ title: 'الفكرة لم تعد موجودة', tone: 'error' });
        else explainRefusal(idea, result.missing);
      }
      return result;
    },
    [explainRefusal],
  );

  return { explainRefusal, trySchedule };
}
