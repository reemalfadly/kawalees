import { useEffect, useRef } from 'react';
import { useSettings } from '@/hooks/data';
import { useUI } from '@/store/ui';

/* A short burst of confetti in the accent colours, drawn on one canvas and
   removed as soon as the last piece lands. Skipped entirely for reduced motion. */

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

export function Confetti() {
  const trigger = useUI((s) => s.confetti);
  const { celebrations } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (trigger === 0 || !celebrations) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const styles = getComputedStyle(document.documentElement);
    const palette = [
      styles.getPropertyValue('--accent').trim(),
      styles.getPropertyValue('--accent-2').trim(),
      '#ffffff',
      '#ffd166',
      '#7c6cff',
    ];

    const pieces: Piece[] = Array.from({ length: 150 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
      const speed = 9 + Math.random() * 9;
      return {
        x: fromLeft ? w * 0.15 : w * 0.85,
        y: h * 0.75,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: palette[i % palette.length] ?? '#fff',
        life: 1,
      };
    });

    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of pieces) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (frame > 70) p.life -= 0.012;
        if (p.life <= 0 || p.y > h + 40) continue;
        alive++;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
        ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trigger, celebrations]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[80] h-full w-full"
      aria-hidden
    />
  );
}
