// Walk session: steps counted from 0 at Start, live while walking, a summary after Stop. Kept in memory only.
// The screen is kept awake during a walk because browsers pause motion readings when the page is hidden.
import { create } from 'zustand';

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
export type WalkSummary = { steps: number; durationMs: number };

type WalkState = {
  status: WalkStatus;
  startedAt: number | null;
  steps: number;
  summary: WalkSummary | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
};

let stopSensor: (() => void) | null = null;
let wakeLock: WakeLockSentinel | null = null;

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
    if (document.visibilityState === 'visible' && useWalk.getState().status === 'walking') void keepAwake();
  });
}

function teardown() {
  stopSensor?.();
  stopSensor = null;
  releaseAwake();
}

export const useWalk = create<WalkState>((set, get) => ({
  status: 'idle',
  startedAt: null,
  steps: 0,
  summary: null,
  start: async () => {
    if (get().status === 'walking' || get().status === 'starting') return;
    set({ status: 'starting', summary: null });
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
  },
  stop: () => {
    const { status, startedAt, steps } = get();
    if (status !== 'walking') return;
    teardown();
    set({ status: 'done', startedAt: null, summary: { steps, durationMs: Date.now() - (startedAt ?? Date.now()) } });
  },
  reset: () => {
    teardown();
    set({ status: 'idle', startedAt: null, steps: 0, summary: null });
  },
}));
