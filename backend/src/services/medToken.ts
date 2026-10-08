// Short-lived signed tokens inside medicine notifications, so the service worker can record "Taken" or
// "Snooze" without a login session. HMAC-SHA256 over uid | medication id | day | time | expiry.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MedTokenPayload {
  uid: string;
  medication_id: string;
  day: string; // YYYY-MM-DD (her local date)
  time: string; // HH:MM
  exp: number; // epoch ms
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

export const MED_TOKEN_TTL_MS = 24 * 3600 * 1000;

export function signMedToken(p: MedTokenPayload, secret: string): string {
  const body = b64(JSON.stringify(p));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyMedToken(token: string, secret: string, now = Date.now()): MedTokenPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(unb64(body)) as MedTokenPayload;
    if (typeof p.exp !== 'number' || p.exp < now) return null;
    return p;
  } catch {
    return null;
  }
}
