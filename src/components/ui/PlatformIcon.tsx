import { PLATFORM_META } from '@/lib/catalog';
import { cn } from '@/lib/cn';
import type { PlatformId } from '@/lib/types';

/* Simplified line glyphs for each platform, drawn to sit with the lucide set. */

const paths: Record<PlatformId, React.ReactNode> = {
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  tiktok: (
    <>
      <path d="M14.5 3.5v10.8a3.8 3.8 0 1 1-3.8-3.8" />
      <path d="M14.5 3.5c.4 2.7 2.4 4.6 5 4.8" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.3 9.4v5.2l4.4-2.6z" fill="currentColor" />
    </>
  ),
  snapchat: (
    <path d="M12 3.6c-2.9 0-4.9 2.1-4.9 5.1v2.1l-1.5.4c-.5.1-.5.8 0 1l1.4.5c-.5 1.3-1.5 2.5-2.9 3.1-.4.2-.3.8.1.9l1.7.4.4 1.2 1.9-.2c.8.9 1.9 1.7 3.8 1.7s3-.8 3.8-1.7l1.9.2.4-1.2 1.7-.4c.4-.1.5-.7.1-.9-1.4-.6-2.4-1.8-2.9-3.1l1.4-.5c.5-.2.5-.9 0-1l-1.5-.4V8.7c0-3-2-5.1-4.9-5.1z" />
  ),
  x: (
    <>
      <path d="M4.5 4.5l15 15" />
      <path d="M19.5 4.5l-15 15" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M8.2 10.5v6" />
      <circle cx="8.2" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
      <path d="M11.8 16.5v-6M11.8 13c0-1.6 1-2.6 2.3-2.6s2.1 1 2.1 2.6v3.5" />
    </>
  ),
};

export function PlatformIcon({
  id,
  size = 16,
  className,
}: {
  id: PlatformId;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[id]}
    </svg>
  );
}

/** A small filled disc in the platform colour. */
export function PlatformDot({
  id,
  size = 22,
  className,
}: {
  id: PlatformId;
  size?: number;
  className?: string;
}) {
  const meta = PLATFORM_META[id];
  return (
    <span
      title={meta.label}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full ring-2 ring-[var(--solid)]',
        className,
      )}
      style={{
        width: size,
        height: size,
        background:
          id === 'instagram' ? 'linear-gradient(45deg,#F58529,#DD2A7B 55%,#8134AF)' : meta.color,
        color: meta.ink,
      }}
    >
      <PlatformIcon id={id} size={Math.round(size * 0.6)} />
    </span>
  );
}

export function PlatformStack({ ids, size = 22 }: { ids: PlatformId[]; size?: number }) {
  if (ids.length === 0) return null;
  return (
    <span
      className="inline-flex items-center"
      aria-label={ids.map((i) => PLATFORM_META[i].label).join('، ')}
    >
      {ids.map((id, i) => (
        <PlatformDot key={id} id={id} size={size} className={i > 0 ? '-ms-1.5' : undefined} />
      ))}
    </span>
  );
}
