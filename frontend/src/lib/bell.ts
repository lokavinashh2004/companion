// The walk timer's bell: three soft strikes of a struck bell, made with Web Audio (no sound file), plus a
// vibration on phones that support it. Browsers only allow sound after a tap, so unlockAudio() is called
// from the Start tap and the bell can then ring on its own when the time is up.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/** Call from a tap (e.g. Start walking) so the bell may ring later without one. */
export function unlockAudio(): void {
  try {
    void audio()?.resume();
  } catch {
    // no audio on this device; the vibration and on-screen notice still work
  }
}

// A bell's overtones are not whole multiples of its note, which is what makes it sound like a bell.
const PARTIALS = [
  { ratio: 1, gain: 0.5, decay: 2.4 },
  { ratio: 2.76, gain: 0.25, decay: 1.4 },
  { ratio: 5.4, gain: 0.12, decay: 0.9 },
  { ratio: 8.93, gain: 0.06, decay: 0.6 },
];
const STRIKES = 3;
const GAP_S = 1.1;
const NOTE_HZ = 660;

export function ringBell(): void {
  navigator.vibrate?.([400, 150, 400, 150, 400]);
  try {
    const ac = audio();
    if (!ac) return;
    void ac.resume();
    const out = ac.createGain();
    out.gain.value = 0.6;
    out.connect(ac.destination);
    for (let k = 0; k < STRIKES; k++) {
      const t0 = ac.currentTime + 0.05 + k * GAP_S;
      for (const p of PARTIALS) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = NOTE_HZ * p.ratio;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(p.gain, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);
        osc.connect(gain).connect(out);
        osc.start(t0);
        osc.stop(t0 + p.decay + 0.05);
      }
    }
  } catch {
    // audio blocked; the vibration and on-screen notice still tell her
  }
}
