import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WalkCard } from '@/components/today/WalkCard';
import i18n from '@/i18n';
import type { Today } from '@/lib/api';
import { createStepDetector } from '@/lib/steps';
import { clock, useWalk, walkCheerKey, walkKcal } from '@/lib/walk';

const TODAY = { day: '2026-10-08', calorie_display: 'show' } as Today;

/** A walking-like bounce: 2 steps a second, ±3 m/s² on top of gravity, sampled at 50 Hz. */
function bounce(seconds: number, emit: (x: number, y: number, z: number, t: number) => void, t0 = 0) {
  for (let i = 0; i <= seconds * 50; i++) {
    const t = t0 + i * 20;
    emit(0.3, 0.2, 9.81 + 3 * Math.sin((2 * Math.PI * 2 * t) / 1000), t);
  }
}

function motion(z: number | null, timeStamp: number) {
  const e = new Event('devicemotion') as Event & { accelerationIncludingGravity: unknown };
  Object.defineProperty(e, 'timeStamp', { value: timeStamp });
  e.accelerationIncludingGravity = z == null ? null : { x: 0.3, y: 0.2, z };
  window.dispatchEvent(e);
}

describe('walk maths', () => {
  it('works out calories with a 70 kg default', () => {
    expect(walkKcal(1000)).toBe(35);
    expect(walkKcal(1234, 60)).toBe(37);
    expect(walkKcal(0)).toBe(0);
  });

  it('picks the cheer by steps', () => {
    expect(walkCheerKey(999)).toBe('walk.cheerStart');
    expect(walkCheerKey(1000)).toBe('walk.cheerGreat');
    expect(walkCheerKey(5000)).toBe('walk.cheerGreat');
    expect(walkCheerKey(5001)).toBe('walk.cheerAmazing');
  });

  it('formats the clock', () => {
    expect(clock(75_000)).toBe('1:15');
    expect(clock(3_725_000)).toBe('1:02:05');
  });
});

describe('step detector', () => {
  it('counts one step per bounce', () => {
    let steps = 0;
    bounce(10, createStepDetector(() => steps++));
    expect(steps).toBeGreaterThanOrEqual(18);
    expect(steps).toBeLessThanOrEqual(21);
  });

  it('ignores a phone lying still', () => {
    let steps = 0;
    const detect = createStepDetector(() => steps++);
    for (let t = 0; t < 5000; t += 20) detect(0.01, 0.02, 9.81 + (t % 40 ? 0.05 : -0.05), t);
    expect(steps).toBe(0);
  });
});

describe('WalkCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-08T07:00:00Z'));
  });
  afterEach(() => {
    cleanup();
    useWalk.getState().reset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('counts steps from 0, shows time, and gives a summary after Stop', async () => {
    vi.stubGlobal('DeviceMotionEvent', class {});
    const remove = vi.spyOn(window, 'removeEventListener');
    render(<WalkCard today={TODAY} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /start walking/i })));
    expect(screen.getByRole('button', { name: /stop walking/i })).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();

    act(() => {
      bounce(5, (_x, _y, z, t) => motion(z, t));
      vi.advanceTimersByTime(65_000);
    });
    const live = useWalk.getState().steps;
    expect(live).toBeGreaterThanOrEqual(9);
    expect(screen.getByText(String(live))).toBeTruthy();
    expect(screen.getByText('1:05')).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: /stop walking/i })));
    expect(remove).toHaveBeenCalledWith('devicemotion', expect.any(Function));
    expect(screen.getByText(/nice start/i)).toBeTruthy();
    expect(screen.getByText(`${walkKcal(live)} kcal`)).toBeTruthy();
    expect(screen.getByText('1:05')).toBeTruthy();

    // No more counting after Stop.
    act(() => bounce(2, (_x, _y, z, t) => motion(z, 100_000 + t)));
    expect(useWalk.getState().summary?.steps).toBe(live);
  });

  it('hides calories when the profile hides them', async () => {
    vi.stubGlobal('DeviceMotionEvent', class {});
    render(<WalkCard today={{ ...TODAY, calorie_display: 'hide' }} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /start walking/i })));
    act(() => motion(9.81, 0));
    act(() => fireEvent.click(screen.getByRole('button', { name: /stop walking/i })));
    expect(screen.queryByText(/kcal/)).toBeNull();
  });

  it('shows a friendly message when motion access is denied', async () => {
    vi.stubGlobal('DeviceMotionEvent', Object.assign(class {}, { requestPermission: async () => 'denied' }));
    render(<WalkCard today={TODAY} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /start walking/i })));
    expect(screen.getByText(/needs motion access/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /start walking/i })).toBeTruthy();
  });

  it('explains when the device sends no motion data', async () => {
    vi.stubGlobal('DeviceMotionEvent', class {});
    render(<WalkCard today={TODAY} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /start walking/i })));
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.getByText(/doesn't share motion data/i)).toBeTruthy();
  });
});
