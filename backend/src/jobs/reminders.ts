// Every 5 minutes: check-in pushes (morning / evening), optional water nudges, medicine reminders with
// Taken / Snooze buttons, and due snoozes. Each reminder is sent once (reminder_log unique key).
import { inQuietHours, localDateTime, localTimeIn, minutesOf, todayIn } from '../core/dates.ts';
import { DuplicateKeyError } from '../store/collection.ts';
import type { UserScope } from '../store/index.ts';
import type { ProfileDoc, ReminderLogDoc } from '../store/types.ts';
import type { Services } from '../services/context.ts';
import { MED_TOKEN_TTL_MS, signMedToken } from '../services/medToken.ts';
import type { PushMessage } from '../services/push.ts';

/** A reminder fires during the hour after its time (the scheduler runs every few minutes). */
export const WINDOW_MINUTES = 60;
const WATER_TIMES = ['11:00', '16:00'];

const TEXT = {
  en: {
    morning: ['Good morning 🌸', 'How did you sleep? Tell me about your morning.'],
    evening: ['How was your day? 💛', "Tell me what you ate and how you're feeling."],
    water: ['Water break 💧', 'A glass of water sounds nice right now.'],
    med: ['Medicine time', ''],
    taken: 'Taken',
    snooze: 'Snooze 30 min',
  },
  ta: {
    morning: ['காலை வணக்கம் 🌸', 'நல்லா தூங்கினியா? உன் காலை எப்படி போகுதுன்னு சொல்லு.'],
    evening: ['இன்னைக்கு எப்படி போச்சு? 💛', 'என்ன சாப்பிட்ட, எப்படி இருக்கன்னு சொல்லு.'],
    water: ['தண்ணீர் இடைவேளை 💧', 'இப்போ ஒரு கிளாஸ் தண்ணீர் குடிச்சா நல்லா இருக்கும்.'],
    med: ['மருந்து நேரம்', ''],
    taken: 'எடுத்தாச்சு',
    snooze: '30 நிமிடம் கழித்து',
  },
} as const;

export function isDue(nowMin: number, at: string): boolean {
  const d = nowMin - minutesOf(at);
  return d >= 0 && d < WINDOW_MINUTES;
}

async function once(u: UserScope, kind: ReminderLogDoc['kind'], ref: string): Promise<boolean> {
  try {
    await u.reminder_log.insertOne({ kind, ref });
    return true;
  } catch (e) {
    if (e instanceof DuplicateKeyError) return false;
    throw e;
  }
}

export async function remindersForUser(s: Services, profile: ProfileDoc, apiUrl: string): Promise<string[]> {
  const uid = profile.user_id;
  const u = s.store.user(uid);
  const tz = profile.timezone;
  const now = s.now();
  const today = todayIn(tz, now);
  const { hour, minute } = localTimeIn(tz, now);
  const nowMin = hour * 60 + minute;
  const t = TEXT[profile.ui_language === 'ta' ? 'ta' : 'en'];
  const sent: string[] = [];
  const quiet = inQuietHours(nowMin, profile.quiet_start, profile.quiet_end);

  const push = async (msg: PushMessage, kind: ReminderLogDoc['kind'], ref: string) => {
    if (!(await once(u, kind, ref))) return;
    const r = await s.push.send(uid, msg, { ref });
    sent.push(`${kind}:${r}`);
  };

  if (!quiet) {
    if (isDue(nowMin, profile.morning_checkin.slice(0, 5))) await push({ kind: 'checkin', title: t.morning[0], body: t.morning[1], url: '/' }, 'morning', today);
    if (isDue(nowMin, profile.evening_checkin.slice(0, 5))) await push({ kind: 'checkin', title: t.evening[0], body: t.evening[1], url: '/' }, 'evening', today);
    if (profile.water_nudges) {
      for (const w of WATER_TIMES) if (isDue(nowMin, w)) await push({ kind: 'water', title: t.water[0], body: t.water[1], url: '/today' }, 'water', `${today}:${w}`);
    }
  }

  // Medicines (her chosen times; not subject to quiet hours or the daily cap).
  const secret = s.env.MED_ACTION_SECRET;
  const medPush = (medId: string, name: string, dose: string | null, time: string) => {
    const token = secret ? signMedToken({ uid, medication_id: medId, day: today, time, exp: now.getTime() + MED_TOKEN_TTL_MS }, secret) : null;
    return {
      kind: 'med' as const,
      title: t.med[0],
      body: `${name}${dose ? ` ${dose}` : ''}`,
      url: '/today',
      tag: `med-${medId}-${time}`,
      actions: token ? [{ action: 'taken' as const, title: t.taken }, { action: 'snooze' as const, title: t.snooze }] : undefined,
      data: token ? { token, api: apiUrl } : undefined,
    };
  };
  const meds = await u.medications.find({ active: true });
  for (const m of meds) {
    for (const time of m.schedule_times) {
      if (!isDue(nowMin, time)) continue;
      const taken = await u.med_intake.findOne({ medication_id: m.id, scheduled_for: localDateTime(today, time, tz), taken: true });
      if (taken) continue;
      await push(medPush(m.id, m.name, m.dose, time), 'med', `${m.id}:${today}:${time}`);
    }
  }
  // Snoozed doses that are due now.
  const due = await u.snoozes.find({ sent: false, due_at: { $lte: now.toISOString() } });
  for (const z of due) {
    await u.snoozes.updateOne({ id: z.id }, { sent: true });
    const m = meds.find((x) => x.id === z.medication_id);
    if (!m) continue;
    const r = await s.push.send(uid, medPush(m.id, m.name, m.dose, z.time), { ref: `snooze:${z.id}` });
    sent.push(`snooze:${r}`);
  }
  return sent;
}

export async function runReminders(s: Services, apiUrl: string): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  const subscribed = new Set((await s.store.unscoped.push_subscriptions.find()).map((x) => x.user_id));
  for (const uid of subscribed) {
    const profile = await s.store.unscoped.profiles.findOne({ user_id: uid });
    if (!profile?.onboarding_done) continue;
    try {
      const sent = await remindersForUser(s, profile, apiUrl);
      if (sent.length) out[uid.slice(0, 6)] = sent;
    } catch (e) {
      console.error('reminders failed for a user', e instanceof Error ? e.message : e);
    }
  }
  return out;
}
