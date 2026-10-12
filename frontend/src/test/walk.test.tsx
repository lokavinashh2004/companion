import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WalkCard } from '@/components/today/WalkCard';
import i18n from '@/i18n';
import type { Today } from '@/lib/api';
import { createStepDetector } from '@/lib/steps';
import { clock, useWalk, walkCheerKey, walkKcal } from '@/lib/walk';
import { Walks } from '@/routes/Walks';
import { ME, mockApi, PROFILE, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token' }));

const DAY = '2026-10-08';
const TODAY = { day: DAY, calorie_display: 'show' } as Today;

const walkDays = (steps: number[]) => steps.map((n, i) => ({ day: `2026-10-0${i + 2}`, steps: n, duration_s: n ? 1200 : 0, sessions: n ? 1 : 0 }));
const WALKS = {
  today: DAY,
  goal: 5000,
  weight_kg: 60,
  days: walkDays([0, 6200, 5400, 0, 3000, 5100, 2400]),
  streak: 0,
  totals: { steps: 22100, duration_s: 6000, sessions: 5, active_days: 5, goal_days: 3 },
  best: { day: '2026-10-03', steps: 6200, duration_s: 1200, sessions: 1 },
  recent: [
    { id: 'w2', day: DAY, started_at: '2026-10-08T01:30:00Z', duration_s: 1200, steps: 2400 },
    { id: 'w1', day: '2026-10-07', started_at: '2026-10-07T12:00:00Z', duration_s: 1500, steps: 5100 },
  ],
};

/** Lets fetches and React Query's setTimeout(0) notifications settle under fake timers. */
const settle = () => act(() => vi.advanceTimersByTimeAsync(20));

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

  const startWalk = async () => {
    fireEvent.click(screen.getByRole('button', { name: /start walking/i }));
    await settle();
  };
  const stopWalk = async () => {
    fireEvent.click(screen.getByRole('button', { name: /stop walking/i }));
    await settle();
  };

  it("shows today's progress, counts steps from 0, and saves the walk on Stop", async () => {
    vi.stubGlobal('DeviceMotionEvent', class {});
    const calls = mockApi({ 'GET /walks': WALKS, 'POST /walks': (b: unknown) => ({ id: 'w9', day: DAY, ...(b as object) }) });
    const remove = vi.spyOn(window, 'removeEventListener');
    renderPage(<WalkCard today={TODAY} />);
    await settle();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2400');
    expect(screen.getByText('2,600 steps to go')).toBeTruthy();
    expect(screen.getByRole('link', { name: /walking history/i }).getAttribute('href')).toBe('/walks');

    await startWalk();
    expect(screen.getByText('0')).toBeTruthy();
    act(() => {
      bounce(5, (_x, _y, z, t) => motion(z, t));
      vi.advanceTimersByTime(65_000);
    });
    const live = useWalk.getState().steps;
    expect(live).toBeGreaterThanOrEqual(9);
    expect(screen.getByText(String(live))).toBeTruthy();
    expect(screen.getByText('1:05')).toBeTruthy();

    await stopWalk();
    expect(remove).toHaveBeenCalledWith('devicemotion', expect.any(Function));
    expect(screen.getByText(/nice start/i)).toBeTruthy();
    // her logged weight (60 kg) is used for calories
    expect(screen.getByText(`${walkKcal(live, 60)} kcal`)).toBeTruthy();
    expect(screen.getByText(/estimated for 60 kg/i)).toBeTruthy();
    expect(screen.getByText(/saved to your walking history/i)).toBeTruthy();
    const post = calls.find((c) => c.method === 'POST' && c.path === '/walks')!;
    expect(post.body).toMatchObject({ steps: live, duration_s: 65, started_at: expect.stringMatching(/^2026-10-08T07:00:00\.\d{3}Z$/) });
    expect((post.body as { client_id: string }).client_id).toMatch(/^[0-9a-f-]{36}$/);

    // No more counting after Stop.
    act(() => bounce(2, (_x, _y, z, t) => motion(z, 100_000 + t)));
    expect(useWalk.getState().summary?.steps).toBe(live);
  });

  it('offers a retry with the same walk when saving fails', async () => {
    vi.stubGlobal('DeviceMotionEvent', class {});
    let fail = true;
    const calls = mockApi({
      'GET /walks': WALKS,
      'POST /walks': (b: unknown) => (fail ? { __status: 500, body: { error: 'internal' } } : { id: 'w9', day: DAY, ...(b as object) }),
    });
    renderPage(<WalkCard today={TODAY} />);
    await settle();
    await startWalk();
    await stopWalk();
    expect(screen.getByText(/couldn't save this walk/i)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await settle();
    expect(screen.getByText(/saved to your walking history/i)).toBeTruthy();
    const ids = calls.filter((c) => c.method === 'POST' && c.path === '/walks').map((c) => (c.body as { client_id: string }).client_id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it('hides calories when the profile hides them', async () => {
    vi.stubGlobal('DeviceMotionEvent', class {});
    mockApi({ 'GET /walks': WALKS, 'POST /walks': { id: 'w9', day: DAY, started_at: '2026-10-08T07:00:00Z', duration_s: 0, steps: 0 } });
    renderPage(<WalkCard today={{ ...TODAY, calorie_display: 'hide' }} />);
    await startWalk();
    act(() => motion(9.81, 0));
    await stopWalk();
    expect(screen.queryByText(/kcal/)).toBeNull();
  });

  it('shows a friendly message when motion access is denied', async () => {
    vi.stubGlobal('DeviceMotionEvent', Object.assign(class {}, { requestPermission: async () => 'denied' }));
    mockApi({ 'GET /walks': WALKS });
    renderPage(<WalkCard today={TODAY} />);
    await startWalk();
    expect(screen.getByText(/needs motion access/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /start walking/i })).toBeTruthy();
  });

  it('explains when the device sends no motion data', async () => {
    vi.stubGlobal('DeviceMotionEvent', class {});
    mockApi({ 'GET /walks': WALKS });
    renderPage(<WalkCard today={TODAY} />);
    await startWalk();
    await act(() => vi.advanceTimersByTimeAsync(3500));
    expect(screen.getByText(/doesn't share motion data/i)).toBeTruthy();
  });
});

describe('Walks dashboard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows today's progress, totals, the daily chart and recent walks", async () => {
    mockApi({ 'GET /walks': WALKS, 'GET /me': ME });
    renderPage(<Walks />);
    expect(await screen.findByText('2,600 steps to go')).toBeTruthy();
    expect(screen.getByText('22,100')).toBeTruthy(); // total steps
    expect(screen.getByText('3,157')).toBeTruthy(); // daily average over 7 days
    expect(screen.getByText('3 of 7')).toBeTruthy(); // goal days
    expect(screen.getByText('1:40:00')).toBeTruthy(); // time walking
    expect(screen.getByRole('img', { name: 'Daily steps' })).toBeTruthy();
    expect(screen.getByText('5,100 steps')).toBeTruthy();
    expect(screen.queryByText(/kcal/)).toBeNull(); // calories hidden in this profile
  });

  it('switches to 30 days and shows calories when they are on', async () => {
    const calls = mockApi({ 'GET /walks': WALKS, 'GET /me': { ...ME, profile: { ...PROFILE, calorie_display: 'show' } } });
    renderPage(<Walks />);
    await screen.findByText('22,100');
    expect(await screen.findByText(`${Math.round(walkKcal(22100, 60))} kcal`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '30 days' }));
    await vi.waitFor(() => expect(calls.some((c) => c.path === '/walks' && c.url.searchParams.get('days') === '30')).toBe(true));
  });

  it('removes a walk after confirming', async () => {
    const calls = mockApi({ 'GET /walks': WALKS, 'GET /me': ME, 'DELETE /walks/{id}': { ok: true } });
    renderPage(<Walks />);
    fireEvent.click(await screen.findByRole('button', { name: /remove the walk on 7 oct/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await vi.waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/walks/w1')).toBe(true));
  });

  it('nudges towards a first walk when there are none', async () => {
    const none = { ...WALKS, days: walkDays([0, 0, 0, 0, 0, 0, 0]), totals: { steps: 0, duration_s: 0, sessions: 0, active_days: 0, goal_days: 0 }, best: null, recent: [] };
    mockApi({ 'GET /walks': none, 'GET /me': ME });
    renderPage(<Walks />);
    expect(await screen.findByText(/no walks in this period yet/i)).toBeTruthy();
    expect(screen.getByText('No walks yet.')).toBeTruthy();
  });
});
