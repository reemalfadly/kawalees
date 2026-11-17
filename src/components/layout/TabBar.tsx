// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { useUI } from '@/store/ui';
import { NAV } from './nav';

/* Phone navigation: a floating glass bar with the capture button in the middle.
   It slides away while a text field has focus (the on-screen keyboard needs the room)
   and comes back when focus leaves. */

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

function isTextEntry(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type);
  return el.isContentEditable;
}

function useTextEntryFocus(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const onIn = (e: FocusEvent) => setTyping(isTextEntry(e.target as Element | null));
    // Focus moving from one field to another fires out then in: settle after both.
    const onOut = () => window.setTimeout(() => setTyping(isTextEntry(document.activeElement)), 0);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);
  return typing;
}

export function TabBar() {
  const openCapture = useUI((s) => s.openCapture);
  const typing = useTextEntryFocus();
  const left = NAV.slice(0, 2);
  const right = NAV.slice(2);

  const renderItem = (item: (typeof NAV)[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      data-ripple
      onClick={() => haptics.tap()}
      className={({ isActive }) =>
        cn(
          'relative flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[20px] text-xs font-medium transition-colors',
          isActive ? 'text-ink' : 'text-ink-3',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="tab-active"
              className="absolute inset-x-1 inset-y-1 -z-10 rounded-[18px] bg-surface-3"
              transition={{ type: 'spring', stiffness: 520, damping: 40 }}
            />
          )}
          <motion.span
            key={isActive ? 'on' : 'off'}
            initial={isActive ? { scale: 0.7, y: 2 } : false}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 14 }}
            className="grid place-items-center"
          >
            <item.icon
              size={22}
              strokeWidth={isActive ? 2.25 : 1.8}
              className={isActive ? 'text-accent-ink' : ''}
            />
          </motion.span>
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <nav
      aria-label="التنقل الرئيسي"
      inert={typing}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[translate,opacity] duration-200 ease-out md:hidden',
        typing && 'pointer-events-none translate-y-[calc(100%+1rem)] opacity-0',
      )}
    >
      <div className="glass-strong mx-auto flex max-w-md items-center gap-1 rounded-[26px] p-1.5">
        {left.map(renderItem)}
        <button
          type="button"
          aria-label="فكرة جديدة"
          onClick={() => {
            haptics.tap();
            openCapture();
          }}
          className="mx-1 grid size-14 shrink-0 place-items-center rounded-[20px] bg-accent-gradient-strong text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_24px_-8px_var(--accent)] transition-transform active:scale-90"
        >
          <Plus size={26} strokeWidth={2.4} />
        </button>
        {right.map(renderItem)}
      </div>
    </nav>
  );
}
