// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { describe, expect, it, vi } from 'vitest';
import {
  clampLevel,
  LEADING_KEY,
  LEADING_LEVELS,
  levelFromLegacySize,
  readLeadingLevel,
  readSizeLevel,
  SIZE_KEY,
  SIZE_LEVELS,
} from '@/features/prompter/readingPrefs';
import { easeToward, ReadingScroller, smoothDamp } from '@/features/prompter/scrollEngine';

const FRAME = 1 / 60;

function engine(max = 2000, min = 0) {
  const applied: number[] = [];
  const onEnd = vi.fn();
  const e = new ReadingScroller(1);
  e.bind({ apply: (p) => applied.push(p), onEnd });
  e.setBounds(min, max);
  return { e, applied, onEnd };
}

function run(e: ReadingScroller, seconds: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < seconds; t += FRAME) {
    e.step(FRAME);
    out.push(e.pos);
  }
  return out;
}

describe('smooth motion maths', () => {
  it('smoothDamp arrives without overshooting', () => {
    let value = 0;
    let velocity = 0;
    let top = 0;
    for (let i = 0; i < 240; i++) {
      ({ value, velocity } = smoothDamp(value, 100, velocity, 0.4, FRAME));
      top = Math.max(top, value);
    }
    expect(top).toBeLessThanOrEqual(100);
    expect(value).toBeCloseTo(100, 1);
    expect(Math.abs(velocity)).toBeLessThan(0.5);
  });

  it('smoothDamp keeps the speed continuous when the target moves', () => {
    let value = 0;
    let velocity = 0;
    for (let i = 0; i < 20; i++)
      ({ value, velocity } = smoothDamp(value, 100, velocity, 0.4, FRAME));
    const before = velocity;
    const next = smoothDamp(value, 160, velocity, 0.4, FRAME);
    expect(Math.abs(next.velocity - before)).toBeLessThan(before * 0.2);
  });

  it('easeToward does not depend on the frame rate', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = easeToward(a, 100, 0.3, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = easeToward(b, 100, 0.3, 1 / 30);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
});

describe('reading scroller', () => {
  it('moves by fractions of a pixel at a slow speed, without a single stalled frame', () => {
    const { e } = engine();
    e.setSpeed(30);
    run(e, 3); // let it get up to speed
    const track = run(e, 2);
    const steps = track.slice(1).map((p, i) => p - (track[i] ?? 0));
    expect(steps.every((d) => d > 0)).toBe(true);
    expect(Math.max(...steps)).toBeLessThan(1);
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    const sd = Math.sqrt(steps.reduce((a, b) => a + (b - mean) ** 2, 0) / steps.length);
    expect(sd / mean).toBeLessThan(0.05);
  });

  it('eases up to speed and down to a stop instead of jumping', () => {
    const { e } = engine(100000);
    e.setSpeed(100);
    const up = run(e, 2).map((_, i, a) => (i ? ((a[i] ?? 0) - (a[i - 1] ?? 0)) / FRAME : 0));
    expect(up[1]).toBeLessThan(10); // not an instant 100 px/s
    expect(up.every((v, i) => i < 2 || v >= (up[i - 1] ?? 0) - 1e-6)).toBe(true);
    expect(up[up.length - 1]).toBeGreaterThan(95);
    e.setSpeed(0);
    const down = run(e, 2).map((_, i, a) => (i ? ((a[i] ?? 0) - (a[i - 1] ?? 0)) / FRAME : 0));
    expect(down[1]).toBeGreaterThan(80); // keeps moving a moment, no hard stop
    expect(down.every((v, i) => i < 2 || v <= (down[i - 1] ?? 0) + 1e-6)).toBe(true);
    const stopped = e.pos;
    run(e, 1);
    expect(e.pos).toBeCloseTo(stopped, 3);
    expect(e.vel).toBe(0);
  });

  it('glides to an offset and rests exactly there', () => {
    const { e } = engine();
    e.glideTo(900);
    const track = run(e, 3);
    expect(Math.max(...track)).toBeLessThanOrEqual(900);
    expect(e.pos).toBe(900);
    expect(e.vel).toBe(0);
    // Steady scrolling takes over again from rest.
    e.setSpeed(60);
    run(e, 1);
    expect(e.pos).toBeGreaterThan(900);
  });

  it('keeps chasing a followed offset and lets go of it', () => {
    const { e } = engine();
    e.follow(300);
    run(e, 2);
    expect(e.pos).toBeCloseTo(300, 0);
    e.follow(520);
    run(e, 2);
    expect(e.pos).toBeCloseTo(520, 0);
    e.follow(null);
    run(e, 1);
    expect(e.pos).toBeCloseTo(520, 0);
  });

  it('stays between the first and the last line, and ends once', () => {
    const { e, onEnd } = engine(120, 40);
    expect(e.pos).toBe(40);
    e.jump(-50);
    expect(e.pos).toBe(40);
    e.setSpeed(200);
    run(e, 4);
    expect(e.pos).toBe(120);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('a drag follows the finger and lets go with momentum, then rests', () => {
    const { e } = engine(5000);
    e.dragStart();
    e.dragMove(20, 0);
    e.dragMove(60, 16);
    e.dragMove(100, 32);
    expect(e.pos).toBe(0); // dragged down from the top: nowhere to go
    e.jump(1000);
    e.dragStart();
    e.dragMove(-20, 0);
    e.dragMove(-60, 16);
    e.dragMove(-100, 32);
    expect(e.pos).toBeCloseTo(1100, 5);
    e.dragEnd(40);
    expect(e.vel).toBeGreaterThan(1000);
    const start = e.pos;
    run(e, 0.5);
    expect(e.pos).toBeGreaterThan(start + 50);
    run(e, 3);
    expect(e.vel).toBe(0);
  });

  it('a wheel notch glides a short way', () => {
    const { e } = engine();
    e.wheel(100);
    run(e, 1);
    expect(e.pos).toBe(100);
  });
});

describe('reading comfort levels', () => {
  it('has five sizes and three line heights', () => {
    expect(SIZE_LEVELS).toHaveLength(5);
    expect(LEADING_LEVELS).toHaveLength(3);
    expect([...SIZE_LEVELS]).toEqual([...SIZE_LEVELS].sort((a, b) => a - b));
  });

  it('clamps stored values to a valid level', () => {
    expect(clampLevel('3', 5, 1)).toBe(3);
    expect(clampLevel('9', 5, 1)).toBe(1);
    expect(clampLevel('-1', 5, 1)).toBe(1);
    expect(clampLevel('x', 5, 1)).toBe(1);
    expect(clampLevel(null, 5, 1)).toBe(1);
    expect(clampLevel(2.5, 5, 1)).toBe(1);
  });

  it('carries an older free-form size over to the nearest level', () => {
    expect(levelFromLegacySize(40)).toBe(1);
    expect(levelFromLegacySize(88)).toBe(4);
    expect(levelFromLegacySize(20)).toBe(0);
    expect(levelFromLegacySize('big')).toBeNull();
  });

  it('reads its own keys first, then the older setting, then the default', () => {
    const store: Record<string, string> = {};
    const read = (k: string) => store[k] ?? null;
    expect(readSizeLevel(read, 'old')).toBe(1);
    store.old = JSON.stringify({ size: 64 });
    expect(readSizeLevel(read, 'old')).toBe(3);
    store[SIZE_KEY] = '0';
    expect(readSizeLevel(read, 'old')).toBe(0);
    store.old = '{not json';
    delete store[SIZE_KEY];
    expect(readSizeLevel(read, 'old')).toBe(1);
    expect(readLeadingLevel(read)).toBe(1);
    store[LEADING_KEY] = '2';
    expect(readLeadingLevel(read)).toBe(2);
  });
});
