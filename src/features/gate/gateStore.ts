// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { create } from 'zustand';
import type { Stage } from '@/lib/types';

/* Transient state of the checkpoint: which idea is being moved where, and which field the
   idea page should focus once the person chooses «انتقال للحقل». Nothing here is saved. */

interface GateState {
  request: { ideaId: string; to: Stage; key: number } | null;
  focus: { ideaId: string; field: string; key: number } | null;
  open: (ideaId: string, to: Stage) => void;
  close: () => void;
  requestFocus: (ideaId: string, field: string) => void;
  clearFocus: () => void;
}

let seq = 0;

export const useGate = create<GateState>((set) => ({
  request: null,
  focus: null,
  open: (ideaId, to) => set({ request: { ideaId, to, key: ++seq } }),
  close: () => set({ request: null }),
  requestFocus: (ideaId, field) => set({ focus: { ideaId, field, key: ++seq } }),
  clearFocus: () => set({ focus: null }),
}));
