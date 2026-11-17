// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710

/* The prompter's own scrolling. The script is never scrolled by the browser: one frame loop
   moves a fractional offset (applied as a transform), so a slow speed glides instead of
   stepping a whole pixel at a time. Speed changes, pauses, jumps and voice-follow all ease:
   nothing ever jumps. Pure and driven by `step(dt)`, so it is tested without a browser. */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * A critically damped spring: moves `current` towards `target` without overshoot and keeps the
 * speed continuous when the target changes in flight (the classic "smooth damp").
 */
export function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
): { value: number; velocity: number } {
  const time = Math.max(0.0001, smoothTime);
  const omega = 2 / time;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  let nextVelocity = (velocity - omega * temp) * decay;
  let value = target + (change + temp) * decay;
  // Never step past the target.
  if (target - current > 0 === value > target) {
    value = target;
    nextVelocity = 0;
  }
  return { value, velocity: nextVelocity };
}

/** Exponential approach, independent of the frame rate: `tau` is the time to cover ~63%. */
export function easeToward(current: number, target: number, tau: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / Math.max(0.0001, tau)));
}

export interface EngineHooks {
  /** Put the content at this offset (called only when it changed). */
  apply: (pos: number) => void;
  /** The steady scroll reached the end of the script. */
  onEnd: () => void;
  /** After every frame that moved something. */
  onFrame?: (pos: number) => void;
}

interface Target {
  y: number;
  /** A follow target is kept (voice mode); a glide ends when it arrives. */
  follow: boolean;
  smooth: number;
}

/** Time constants, in seconds. */
const START_TAU = 0.42; // speeding up to the steady speed
const STOP_TAU = 0.22; // slowing to a stop
const FOLLOW_SMOOTH = 0.4; // chasing the spoken word
const FLING_CAP = 4000;

export class ReadingScroller {
  pos = 0;
  vel = 0;
  /** The offset that puts the first line on the reading band (the script starts here). */
  min = 0;
  max = 0;
  private speed = 0;
  private target: Target | null = null;
  private dragging = false;
  private dragBase = 0;
  private samples: { t: number; y: number }[] = [];
  private ended = false;
  private raf = 0;
  private last = 0;
  private applied = Number.NaN;

  private hooks: EngineHooks = { apply: () => {}, onEnd: () => {} };
  private readonly dpr: number;

  constructor(dpr = 1) {
    this.dpr = dpr;
  }

  /** Connect the engine to the screen (the callbacks can change between renders). */
  bind(hooks: EngineHooks): void {
    this.hooks = hooks;
    this.applied = Number.NaN;
  }

  /** Steady speed in pixels per second (0 = paused). */
  setSpeed(pxPerSecond: number): void {
    this.speed = Math.max(0, pxPerSecond);
    if (this.speed > 0 && this.pos < this.max - 2) this.ended = false;
    this.wake();
  }

  /** The first and last offsets: first line on the band, last line on the band. */
  setBounds(min: number, max: number): void {
    this.max = Math.max(0, max);
    this.min = clamp(min, 0, this.max);
    this.pos = clamp(this.pos, this.min, this.max);
    this.emit();
    this.wake();
  }

  /** Keep chasing this offset (voice mode); null lets go. */
  follow(y: number | null): void {
    this.target =
      y === null ? null : { y: clamp(y, this.min, this.max), follow: true, smooth: FOLLOW_SMOOTH };
    if (y !== null) this.ended = false;
    this.wake();
  }

  /** Glide to an offset and stop there. */
  glideTo(y: number, smooth?: number): void {
    const to = clamp(y, this.min, this.max);
    this.target = {
      y: to,
      follow: false,
      smooth: smooth ?? clamp(0.26 + Math.abs(to - this.pos) / 9000, 0.26, 0.42),
    };
    this.ended = false;
    this.wake();
  }

  /** Move straight there, no easing. */
  jump(y: number): void {
    this.pos = clamp(y, this.min, this.max);
    this.vel = 0;
    this.target = null;
    this.emit();
    this.wake();
  }

  /** A mouse wheel or trackpad: a short glide from wherever the offset is heading. */
  wheel(dy: number): void {
    if (this.target?.follow) {
      this.pos = clamp(this.pos + dy, this.min, this.max);
      this.vel = 0;
      this.emit();
    } else {
      this.glideTo((this.target?.y ?? this.pos) + dy, 0.16);
    }
    this.wake();
  }

  dragStart(): void {
    this.dragging = true;
    this.dragBase = this.pos;
    this.vel = 0;
    if (this.target && !this.target.follow) this.target = null;
    this.samples = [];
  }

  /** `dy` is how far the finger has moved down since the drag began. */
  dragMove(dy: number, t: number): void {
    if (!this.dragging) return;
    this.pos = clamp(this.dragBase - dy, this.min, this.max);
    this.samples.push({ t, y: this.pos });
    while (this.samples.length > 2 && t - (this.samples[0]?.t ?? t) > 120) this.samples.shift();
    this.emit();
  }

  /** Let go: the content keeps its momentum, then eases to the steady speed (or rests). */
  dragEnd(t: number): void {
    if (!this.dragging) return;
    this.dragging = false;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    let v = 0;
    if (first && last && last.t > first.t && t - last.t < 80) {
      v = ((last.y - first.y) / (last.t - first.t)) * 1000;
    }
    this.vel = clamp(v, -FLING_CAP, FLING_CAP);
    this.samples = [];
    this.wake();
  }

  /** Advance by `dt` seconds. Returns true while something is still moving. */
  step(dt: number): boolean {
    if (this.dragging) return true;
    const t = this.target;
    if (t) {
      const r = smoothDamp(this.pos, t.y, this.vel, t.smooth, dt);
      this.pos = r.value;
      this.vel = r.velocity;
      if (!t.follow && Math.abs(t.y - this.pos) < 0.6 && Math.abs(this.vel) < 14) {
        this.pos = t.y;
        this.vel = 0;
        this.target = null;
      }
    } else {
      const tau = this.speed > this.vel ? START_TAU : STOP_TAU;
      this.vel = easeToward(this.vel, this.speed, tau, dt);
      if (this.speed === 0 && Math.abs(this.vel) < 0.4) this.vel = 0;
      this.pos += this.vel * dt;
    }
    if (this.pos <= this.min) {
      this.pos = this.min;
      if (this.vel < 0) this.vel = 0;
    } else if (this.pos >= this.max) {
      this.pos = this.max;
      if (this.vel > 0) this.vel = 0;
      if (!this.target && this.speed > 0 && this.max > 0 && !this.ended) {
        this.ended = true;
        this.emit();
        this.hooks.onEnd();
        return false;
      }
    }
    this.emit();
    return this.target !== null || this.vel !== 0 || this.speed > 0;
  }

  private emit(): void {
    if (this.pos === this.applied) return;
    this.applied = this.pos;
    this.hooks.apply(this.pos);
    this.hooks.onFrame?.(this.pos);
  }

  /** Start the frame loop if it is not running (it stops by itself when everything rests). */
  wake(): void {
    if (this.raf || typeof requestAnimationFrame === 'undefined') return;
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = clamp((now - this.last) / 1000, 0, 0.05);
      this.last = now;
      if (this.step(dt)) this.raf = requestAnimationFrame(tick);
      else {
        this.raf = 0;
        this.settle();
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** At rest, sit exactly on a device pixel so the text is crisp. */
  private settle(): void {
    const snapped = Math.round(this.pos * this.dpr) / this.dpr;
    this.pos = clamp(snapped, this.min, this.max);
    this.emit();
  }

  destroy(): void {
    if (this.raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
