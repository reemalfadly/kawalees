import { db } from './db';
import type { ErrorEntry } from './types';

/* The error tracker: catches every uncaught error and rejected promise, keeps
   the last 100 on the device (never sent anywhere), and folds repeats into a
   single row with a count. Visible under Settings → Diagnostics. */

export const ERROR_LIMIT = 100;
const REPEAT_WINDOW = 60_000;

function currentRoute(): string {
  try {
    return location.hash.replace(/^#/, '') || '/';
  } catch {
    return '';
  }
}

function describe(error: unknown): { message: string; stack: string } {
  if (error instanceof Error)
    return { message: error.message || error.name, stack: error.stack ?? '' };
  if (typeof error === 'string') return { message: error, stack: '' };
  try {
    return { message: JSON.stringify(error), stack: '' };
  } catch {
    return { message: String(error), stack: '' };
  }
}

const listeners = new Set<(e: ErrorEntry) => void>();

export function onTrackedError(fn: (e: ErrorEntry) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function trackError(
  error: unknown,
  source: ErrorEntry['source'] = 'manual',
): Promise<void> {
  const { message, stack } = describe(error);
  // Resize-observer noise is harmless and fires constantly in some browsers.
  if (/ResizeObserver loop/i.test(message)) return;
  try {
    const now = Date.now();
    const recent = await db.errors.orderBy('at').reverse().limit(10).toArray();
    const same = recent.find((e) => e.message === message && now - e.at < REPEAT_WINDOW);
    let entry: ErrorEntry;
    if (same?.id != null) {
      entry = { ...same, at: now, count: same.count + 1 };
      await db.errors.put(entry);
    } else {
      entry = {
        at: now,
        message,
        stack,
        source,
        route: currentRoute(),
        count: 1,
        version: __APP_VERSION__,
      };
      entry.id = await db.errors.add(entry);
      const excess = (await db.errors.count()) - ERROR_LIMIT;
      if (excess > 0) {
        const oldest = await db.errors.orderBy('at').limit(excess).primaryKeys();
        await db.errors.bulkDelete(oldest);
      }
    }
    listeners.forEach((fn) => fn(entry));
  } catch {
    // The tracker must never become a source of errors itself.
  }
  console.error('[kawalees]', error);
}

let installed = false;

export function installTracker(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    void trackError(e.error ?? e.message, 'window');
  });
  window.addEventListener('unhandledrejection', (e) => {
    void trackError(e.reason, 'promise');
  });
}
