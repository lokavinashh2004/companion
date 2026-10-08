// One entry point for the external scheduler (e.g. cron-job.org every 5 minutes → POST /jobs/tick).
// Frequent jobs run on every tick; daily/weekly jobs run once per period (job_runs unique key), so a
// missed or repeated tick never double-sends. Times are UTC here; per-user local times are checked inside.
import { todayIn } from '../core/dates.ts';
import { DuplicateKeyError } from '../store/collection.ts';
import type { Services } from '../services/context.ts';
import { runCycleCheck } from './cycleCheck.ts';
import { runDailySummary } from './dailySummary.ts';
import { runModelHealth } from './modelHealth.ts';
import { runReminders } from './reminders.ts';
import { runRetryQueue } from './retryQueue.ts';

async function claim(s: Services, job: string, period: string): Promise<boolean> {
  try {
    await s.store.shared.job_runs.insertOne({ job, period });
    return true;
  } catch (e) {
    if (e instanceof DuplicateKeyError) return false;
    throw e;
  }
}

export type JobName = 'reminders' | 'retry-queue' | 'cycle-check' | 'daily-summary' | 'model-health';

export async function runJob(s: Services, name: JobName, apiUrl: string): Promise<unknown> {
  switch (name) {
    case 'reminders':
      return runReminders(s, apiUrl);
    case 'retry-queue':
      return runRetryQueue(s);
    case 'cycle-check':
      return runCycleCheck(s);
    case 'daily-summary':
      return runDailySummary(s);
    case 'model-health':
      return runModelHealth(s.store, s.fetch);
  }
}

export async function tick(s: Services, apiUrl: string): Promise<Record<string, unknown>> {
  const now = s.now();
  const ist = todayIn('Asia/Kolkata', now);
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(now);
  const out: Record<string, unknown> = {};
  const safe = async (name: JobName) => {
    try {
      out[name] = await runJob(s, name, apiUrl);
    } catch (e) {
      out[name] = `error: ${e instanceof Error ? e.message : e}`;
    }
  };

  await safe('reminders');
  await safe('retry-queue');
  // Daily jobs: the per-user code checks local times; these gates keep the work to once a day.
  if (hm >= '09:00' && (await claim(s, 'cycle-check', ist))) await safe('cycle-check');
  if (hm >= '23:30' && (await claim(s, 'daily-summary', ist))) await safe('daily-summary');
  if (weekday === 'Mon' && hm >= '03:00' && (await claim(s, 'model-health', ist))) await safe('model-health');
  return out;
}
