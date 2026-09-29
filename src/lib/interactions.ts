/* Delegated micro-interactions, installed once at start-up:
   - ripple: a Material-style ink ripple from the touch point on [data-ripple]
   - spotlight: pointer-following light on [data-spotlight] cards (desktop only)
   One listener each for the whole app, so components only add a data attribute. */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function spawnRipple(e: PointerEvent) {
  if (e.button !== 0 || reduced()) return;
  const host = (e.target as Element | null)?.closest<HTMLElement>('[data-ripple]');
  if (!host || host.matches(':disabled,[aria-disabled="true"]')) return;
  const rect = host.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
  const dot = document.createElement('span');
  dot.className = 'ripple';
  dot.style.width = dot.style.height = `${radius * 2}px`;
  dot.style.left = `${x - radius}px`;
  dot.style.top = `${y - radius}px`;
  host.appendChild(dot);
  dot.addEventListener('animationend', () => dot.remove(), { once: true });
}

function moveSpotlight(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  const host = (e.target as Element | null)?.closest<HTMLElement>('[data-spotlight]');
  if (!host) return;
  const rect = host.getBoundingClientRect();
  host.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  host.style.setProperty('--my', `${e.clientY - rect.top}px`);
}

let installed = false;

export function installInteractions(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', spawnRipple, { passive: true });
  document.addEventListener('pointermove', moveSpotlight, { passive: true });
}
