// A soft two-note chime when Companion replies, made with Web Audio (no sound file). Mute is a display
// preference kept in localStorage (like the theme); nothing about the conversation is stored.
import { create } from 'zustand';

const KEY = 'chat_muted';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const useChatSound = create<{ muted: boolean; toggle: () => void }>((set, get) => ({
  muted: read(),
  toggle: () => {
    const muted = !get().muted;
    try {
      localStorage.setItem(KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
    set({ muted });
  },
}));

let ctx: AudioContext | null = null;

export function playChime(): void {
  if (useChatSound.getState().muted) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    const t0 = ctx.currentTime;
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t0 + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    }
  } catch {
    // audio unavailable: stay quiet
  }
}
