// Step counting from the accelerometer (devicemotion). Browsers have no step-counter sensor, so we detect
// the bounce of each step ourselves. Readings stop while the page is hidden; nothing is stored or sent.

type MotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

export type MotionAccess = 'granted' | 'denied' | 'unsupported';

/** iOS asks for motion access (must be called from a tap); Android and desktop browsers don't ask. */
export async function requestMotionAccess(): Promise<MotionAccess> {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return 'unsupported';
  const Ctor = window.DeviceMotionEvent as MotionCtor;
  if (typeof Ctor.requestPermission !== 'function') return 'granted';
  try {
    return (await Ctor.requestPermission()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

const GRAVITY_TAU = 1; // seconds: slow average of the magnitude (gravity + posture)
const SMOOTH_TAU = 0.05; // seconds: takes off sensor jitter
const HIGH = 1.2; // m/s² above gravity counts as a step peak
const LOW = 0.4; // must drop back below this before the next step
const MIN_GAP = 250; // ms: no faster than 4 steps a second

/** Feed it (x, y, z in m/s², time in ms); it calls onStep once per detected step. */
export function createStepDetector(onStep: () => void) {
  let gravity: number | null = null;
  let smooth = 0;
  let lastT: number | null = null;
  let armed = true;
  let lastStep = -Infinity;
  return (x: number, y: number, z: number, t: number) => {
    const mag = Math.hypot(x, y, z);
    const dt = lastT == null ? 0 : Math.max(0, (t - lastT) / 1000);
    lastT = t;
    if (gravity == null) {
      gravity = mag;
      return;
    }
    gravity += (mag - gravity) * (1 - Math.exp(-dt / GRAVITY_TAU));
    smooth += (mag - gravity - smooth) * (1 - Math.exp(-dt / SMOOTH_TAU));
    if (armed && smooth > HIGH && t - lastStep >= MIN_GAP) {
      armed = false;
      lastStep = t;
      onStep();
    } else if (!armed && smooth < LOW) {
      armed = true;
    }
  };
}

const NO_DATA_MS = 3000;

/** Starts listening. onNoSensor fires if no reading arrives (e.g. a laptop). Returns a stop function. */
export function startStepSensor(onStep: () => void, onNoSensor: () => void): () => void {
  const detect = createStepDetector(onStep);
  let seen = false;
  const listener = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (a?.x == null || a.y == null || a.z == null) return;
    seen = true;
    detect(a.x, a.y, a.z, e.timeStamp);
  };
  window.addEventListener('devicemotion', listener);
  const timer = setTimeout(() => {
    if (!seen) onNoSensor();
  }, NO_DATA_MS);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('devicemotion', listener);
  };
}
