// Daily (09:00 her time): auto-closes long open periods, detects delays (one check-in at 1, 7 and 14 days
// late — never daily), raises red flags, and sends one soft nudge after 3 days away.
import { AUTO_CLOSE_DAYS, contributingFactors, dueDelayKey, redFlags, shouldAutoClose } from '../core/cycle.ts';
import { addDays, todayIn } from '../core/dates.ts';
import { delayCheckIn, pick, SERVER_MESSAGES } from '../core/messages.ts';
import { DuplicateKeyError } from '../store/collection.ts';
import type { UserScope } from '../store/index.ts';
import type { InsightDoc, ProfileDoc } from '../store/types.ts';
import type { Services } from '../services/context.ts';
import { loadCycle } from '../services/cycle.ts';

function userLang(p: ProfileDoc): 'en' | 'ta' | 'tanglish' {
  if (p.display_language !== 'auto') return p.display_language;
  return p.ui_language === 'ta' ? 'ta' : 'en';
}

/** Inserts an insight once; returns it only if it is new. */
async function insertOnce(u: UserScope, doc: Omit<InsightDoc, 'id' | 'created_at' | 'user_id'>): Promise<InsightDoc | null> {
  try {
    return await u.insights.insertOne(doc);
  } catch (e) {
    if (e instanceof DuplicateKeyError) return null;
    throw e;
  }
}

export async function cycleCheckForUser(s: Services, p: ProfileDoc): Promise<Record<string, unknown>> {
  const u = s.store.user(p.user_id);
  const now = s.now();
  const today = todayIn(p.timezone, now);
  const lang = userLang(p);
  const result: Record<string, unknown> = {};

  for (const per of await u.periods.find({ end_date: null })) {
    if (shouldAutoClose(per.start_date, today)) {
      await u.periods.updateOne({ id: per.id }, { end_date: addDays(per.start_date, AUTO_CLOSE_DAYS - 1), auto_closed: true });
      result.autoClosed = true;
    }
  }

  const { periods, prediction, status, lengths } = await loadCycle(u, p.typical_cycle_length, today);

  if (status.kind === 'late' && prediction) {
    const key = dueDelayKey(status.daysLate);
    const lastStart = periods.at(-1)!.start_date;
    if (key) {
      const from = addDays(prediction.likely, -45);
      const [moods, life, weights, meds, foods] = await Promise.all([
        u.mood_logs.find({ day: { $gte: from } }),
        u.lifestyle_logs.find({ day: { $gte: addDays(from, -35) } }),
        u.weight_logs.find({ day: { $gte: from } }),
        u.medications.find(),
        u.food_logs.find({ day: { $gte: from } }),
      ]);
      const intake = new Map<string, number>();
      for (const f of foods) intake.set(f.day, (intake.get(f.day) ?? 0) + Number(f.kcal ?? 0));
      const factors = contributingFactors({
        expectedStart: prediction.likely,
        today,
        lastStart,
        historyLengths: lengths,
        moods,
        lifestyle: life,
        weights,
        medications: meds,
        intakeByDay: [...intake].map(([day, kcal]) => ({ day, kcal })),
      });
      const inserted = await insertOnce(u, {
        day: today,
        type: 'delay',
        key: `${lastStart}:${key}`,
        payload: { days_late: status.daysLate, factors, window: { earliest: prediction.earliest, latest: prediction.latest } },
        shown: true,
        dismissed: false,
      });
      if (inserted) {
        await u.messages.insertOne({
          client_id: null, role: 'assistant', content: delayCheckIn(lang, status.daysLate, factors), language: lang,
          status: 'done', model_id: null, retry_count: 0, error: null, meta: { kind: 'delay_checkin' },
        });
        result.delay = await s.push.send(p.user_id, { kind: 'delay', title: pick(SERVER_MESSAGES.delayTitle, lang), body: pick(SERVER_MESSAGES.delayBody, lang), url: '/' }, { ref: key });
      }
    }
  }

  const symptoms = await u.symptom_logs.find({ day: { $gte: addDays(today, -120) } });
  for (const flag of redFlags({ today, periods, symptoms })) {
    const inserted = await insertOnce(u, { day: today, type: 'red_flag', key: flag.key, payload: { rule: flag.rule }, shown: false, dismissed: false });
    if (inserted) {
      result.redFlag = await s.push.send(p.user_id, { kind: 'red_flag', title: pick(SERVER_MESSAGES.redFlagTitle, lang), body: pick(SERVER_MESSAGES.redFlagBody, lang), url: '/cycle' }, { ref: flag.key });
    }
  }

  // One soft nudge after 3 days away, then quiet until she comes back.
  const opened = p.last_opened_at ? Date.parse(p.last_opened_at) : 0;
  const nudged = p.soft_nudge_sent_at ? Date.parse(p.soft_nudge_sent_at) : 0;
  if (opened && now.getTime() - opened > 3 * 86_400_000 && nudged < opened) {
    const r = await s.push.send(p.user_id, { kind: 'soft_nudge', title: 'Companion', body: pick(SERVER_MESSAGES.softNudge, lang), url: '/' });
    if (r === 'sent') await u.profiles.updateOne({}, { soft_nudge_sent_at: now.toISOString() });
    result.nudge = r;
  }
  return result;
}

export async function runCycleCheck(s: Services, onlyIfLocalHourAtLeast = 9): Promise<number> {
  let n = 0;
  for (const p of await s.store.unscoped.profiles.find({ onboarding_done: true })) {
    // Run once per local day, at/after 09:00 her time (the tick dispatcher dedupes per day).
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: p.timezone, hour: '2-digit', hourCycle: 'h23' }).format(s.now()));
    if (hour < onlyIfLocalHourAtLeast) continue;
    try {
      await cycleCheckForUser(s, p);
      n++;
    } catch (e) {
      console.error('cycle-check failed for a user', e instanceof Error ? e.message : e);
    }
  }
  return n;
}
