// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { useEffect } from 'react';
import { useIdeas } from '@/hooks/data';
import { persistAfterFirstIdea } from '@/lib/protect';
import { isDemoData } from '@/lib/seed';
import { trackError } from '@/lib/tracker';

/* Asks the browser to keep the data safe once there is something worth keeping: the first real
   idea (the sample month doesn't count). It asks once; Settings shows the answer and can ask again. */

let started = false;

export function PersistAfterFirstIdea() {
  const ideas = useIdeas();
  const worthKeeping = ideas.length > 0 && !isDemoData(ideas);

  useEffect(() => {
    if (!worthKeeping || started) return;
    started = true;
    persistAfterFirstIdea().catch((e) => void trackError(e, 'manual'));
  }, [worthKeeping]);

  return null;
}
