/* Counts open modal sheets so global keyboard shortcuts stay quiet while one is
   open, and drives the iOS "page steps back" effect behind sheets on phones. */

let open = 0;

function sync() {
  const root = document.documentElement;
  if (open > 0) {
    if (root.dataset.sheet === 'open') return;
    // The page scrolls with the document, so the effect is anchored to what's on screen.
    const app = document.getElementById('root');
    const y = window.scrollY;
    const height = app?.scrollHeight ?? window.innerHeight;
    root.style.setProperty('--sheet-y', `${y}px`);
    root.style.setProperty('--sheet-bottom', `${Math.max(0, height - y - window.innerHeight)}px`);
    root.dataset.sheet = 'open';
  } else {
    delete root.dataset.sheet;
  }
}

export function modalOpened(): () => void {
  open++;
  sync();
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    open = Math.max(0, open - 1);
    sync();
  };
}

export function isModalOpen(): boolean {
  return open > 0;
}
