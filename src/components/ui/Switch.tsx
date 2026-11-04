// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

/* iOS-style switch: a springy thumb on a pill track that fills with the accent. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptics.tap();
        onChange(!checked);
      }}
      className={cn(
        'relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-300 disabled:opacity-40',
        checked ? 'bg-accent-gradient-strong justify-end' : 'justify-start bg-surface-3',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 36 }}
        className="block size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.18),0_1px_1px_rgb(0_0_0/0.16)]"
      />
    </button>
  );
}
