// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { useEffect, useState } from 'react';

/* Install state: whether we're already running as an installed app, and the
   browser's own install prompt when it offers one (Chrome, Edge, Android). */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn());
  });
}

export function isStandalone(): boolean {
  // The downloaded desktop and Android apps are installed by definition.
  if (__NATIVE__) return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type Platform = 'ios' | 'android' | 'windows' | 'mac';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(ua);
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  // Windows, Linux and ChromeOS all install the same way through Chrome or Edge.
  return 'windows';
}

export function useInstall() {
  const [canPrompt, setCanPrompt] = useState(() => deferred !== null);
  const [installed, setInstalled] = useState(() => isStandalone());
  useEffect(() => {
    const update = () => {
      setCanPrompt(deferred !== null);
      setInstalled(isStandalone());
    };
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const prompt = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    setCanPrompt(false);
    return choice.outcome === 'accepted';
  };

  return { canPrompt, installed, prompt };
}
