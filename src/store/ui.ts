import { create } from 'zustand';
import type { IdeaDraft } from '@/lib/repo';

/* Transient UI state only. Anything worth keeping lives in IndexedDB. */

export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone?: 'default' | 'success' | 'error';
  action?: { label: string; run: () => void };
  duration?: number;
}

interface UIState {
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;

  capture: { open: boolean; preset?: Partial<IdeaDraft> };
  openCapture: (preset?: Partial<IdeaDraft>) => void;
  closeCapture: () => void;

  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  installOpen: boolean;
  setInstallOpen: (open: boolean) => void;

  freshOpen: boolean;
  setFreshOpen: (open: boolean) => void;

  confetti: number;
  celebrate: () => void;
}

let toastSeq = 0;

export const useUI = create<UIState>((set) => ({
  toasts: [],
  toast: (t) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  capture: { open: false },
  openCapture: (preset) => set({ capture: { open: true, preset } }),
  closeCapture: () => set({ capture: { open: false } }),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  installOpen: false,
  setInstallOpen: (installOpen) => set({ installOpen }),

  freshOpen: false,
  setFreshOpen: (freshOpen) => set({ freshOpen }),

  confetti: 0,
  celebrate: () => set((s) => ({ confetti: s.confetti + 1 })),
}));

export const toast = (t: Omit<Toast, 'id'>) => useUI.getState().toast(t);
