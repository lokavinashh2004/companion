// Walk session: steps counted from 0 at Start, live while walking, a summary after Stop. The session lives in
// memory; the Walk card saves the finished walk to the server.
// The screen is kept awake during a walk because browsers pause motion readings when the page is hidden.
// An optional walk length rings a bell when the time is up (the walk keeps going until she stops it).
import { create } from 'zustand';

import i18n from '@/i18n';
import { ringBell, unlockAudio } from './bell';
import { uuid } from './format';
import { requestMotionAccess, startStepSensor } from './steps';

export const DEFAULT_WEIGHT_KG = 70;
const KCAL_PER_STEP_PER_KG = 0.0005;

export function walkKcal(steps: number, weightKg = DEFAULT_WEIGHT_KG): number {
  return Math.round(steps * weightKg * KCAL_PER_STEP_PER_KG * 10) / 10;
}

export function walkCheerKey(steps: number): 'walk.cheerStart' | 'walk.cheerGreat' | 'walk.cheerAmazing' {
  if (steps < 1000) return 'walk.cheerStart';
  if (steps <= 5000) return 'walk.cheerGreat';
  return 'walk.cheerAmazing';
}

/** 75_000 → "1:15", 3_725_000 → "1:02:05". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export type WalkStatus = 'idle' | 'starting' | 'walking' | 'done' | 'denied' | 'unsupported';
/** clientId makes a retried save idempotent on the server. */
export type WalkSummary = { clientId: string; startedAt: number; steps: number; durationMs: number; goalMinutes: number | null };

export const WALK_MINUTES = [10, 15, 20, 30, 45, 60] as const;
export const MAX_WALK_MINUTES = 180;
const MINUTES_KEY = 'walk_minutes'; // the last walk length she picked (a display preference)

function readMinutes(): number | null {
  try {
    const n = Number(localStorage.getItem(MINUTES_KEY));
    return Number.isInteger(n) && n >= 1 && n <= MAX_WALK_MINUTES ? n : null;
  } catch {
    return null;
  }
}

type WalkState = {
  status: WalkStatus;
  startedAt: number | null;
  steps: number;
  summary: WalkSummary | null;
  /** Walk length for this walk (null = no timer), and whether its bell has rung. */
  goalMinutes: number | null;
  bellRang: boolean;
  /** Last picked walk length, offered next time. */
  preferredMinutes: number | null;
  setPreferredMinutes: (minutes: number | null) => void;
  start: (minutes?: number | null) => Promise<void>;
  /** Ends the walk and returns its summary (null when no walk was running). */
  stop: () => WalkSummary | null;
  reset: () => void;
};

let stopSensor: (() => void) | null = null;
let wakeLock: WakeLockSentinel | null = null;
let bellTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Rings the bell at startedAt + minutes. Each check works from the clock, not from elapsed timer ticks, so a
 * delayed timer can't make it drift; it re-checks at least once a minute and whenever the page comes back.
 */
function armBell() {
  if (bellTimer) clearTimeout(bellTimer);
  bellTimer = null;
  const { status, startedAt, goalMinutes, bellRang } = useWalk.getState();
  if (status !== 'walking' || startedAt == null || goalMinutes == null || bellRang) return;
  const left = startedAt + goalMinutes * 60_000 - Date.now();
  if (left > 0) {
    bellTimer = setTimeout(armBell, Math.min(left, 60_000));
    return;
  }
  useWalk.setState({ bellRang: true });
  ringBell();
  notifyIfHidden(goalMinutes);
}

/** If the app is in the background, also show a notification (when she has allowed them). */
function notifyIfHidden(minutes: number) {
  try {
    if (document.visibilityState !== 'hidden' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    void navigator.serviceWorker?.ready.then((r) =>
      r.showNotification(i18n.t('walk.bellTitle', { count: minutes }), { body: i18n.t('walk.bellBody'), tag: 'walk-bell' }),
    );
  } catch {
    // notifications unavailable; the bell and vibration still ran
  }
}

async function keepAwake() {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null; // not supported or refused; counting still works while the screen is on
  }
}

function releaseAwake() {
  void wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}

// The wake lock is dropped when the page is hidden; take it again when the walker comes back.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || useWalk.getState().status !== 'walking') return;
    void keepAwake();
    armBell(); // rings straight away if the time passed while the page was hidden
  });
}

function teardown() {
  stopSensor?.();
  stopSensor = null;
  if (bellTimer) clearTimeout(bellTimer);
  bellTimer = null;
  releaseAwake();
}

export const useWalk = create<WalkState>((set, get) => ({
  status: 'idle',
  startedAt: null,
  steps: 0,
  summary: null,
  goalMinutes: null,
  bellRang: false,
  preferredMinutes: readMinutes(),
  setPreferredMinutes: (minutes) => {
    try {
      if (minutes == null) localStorage.removeItem(MINUTES_KEY);
      else localStorage.setItem(MINUTES_KEY, String(minutes));
    } catch {
      // ignore
    }
    set({ preferredMinutes: minutes });
  },
  start: async (minutes = null) => {
    if (get().status === 'walking' || get().status === 'starting') return;
    unlockAudio(); // still inside the Start tap, so the bell may ring later
    set({ status: 'starting', summary: null, goalMinutes: minutes, bellRang: false });
    const access = await requestMotionAccess();
    if (access !== 'granted') {
      set({ status: access });
      return;
    }
    set({ status: 'walking', startedAt: Date.now(), steps: 0 });
    stopSensor = startStepSensor(
      () => set((st) => ({ steps: st.steps + 1 })),
      () => {
        teardown();
        set({ status: 'unsupported', startedAt: null, steps: 0 });
      },
    );
    void keepAwake();
    armBell();
  },
  stop: () => {
    const { status, startedAt, steps, goalMinutes } = get();
    if (status !== 'walking' || startedAt == null) return null;
    teardown();
    const summary = { clientId: uuid(), startedAt, steps, durationMs: Date.now() - startedAt, goalMinutes };
    set({ status: 'done', startedAt: null, summary });
    return summary;
  },
  reset: () => {
    teardown();
    set({ status: 'idle', startedAt: null, steps: 0, summary: null, goalMinutes: null, bellRang: false });
  },
}));
