// Owner-only usage page: LLM requests used and left today, tokens, a 14-day history, the OpenRouter key and
// each model's health. Firebase sign-in as usual; only admin accounts (see app.ts) get past the 403.
// Aggregate numbers only: no user, message or health data.
import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';

import { AdminUsageSchema } from '../contract.ts';
import { addDays } from '../core/dates.ts';
import { usageDay } from '../services/llm.ts';
import { jsonRes, type App, type AppDeps } from './shared.ts';

const sec = [{ firebase: [] }];
const DAYS = 14;

export function registerAdmin(app: App, { services: s }: AppDeps) {
  app.openapi(
    createRoute({ method: 'get', path: '/admin/usage', tags: ['admin'], security: sec, responses: { 200: jsonRes(AdminUsageSchema, 'LLM usage for the owner') } }),
    async (c) => {
      if (!c.get('admin')) throw new HTTPException(403, { message: 'forbidden' });
      const now = s.now();
      const day = usageDay(now);
      const from = addDays(day, -(DAYS - 1));
      const [rows, models, remaining, check] = await Promise.all([
        s.store.shared.llm_usage.find({ day: { $gte: from } }),
        s.store.shared.llm_models.find({}, { sort: { priority: 1 } }),
        s.llm.remaining(),
        s.llm.check ? s.llm.check({ probe: false }) : Promise.resolve(null),
      ]);
      const byDay = new Map(rows.map((r) => [r.day, r]));
      const history = Array.from({ length: DAYS }, (_, i) => {
        const d = addDays(from, i);
        const r = byDay.get(d);
        return { day: d, requests: r?.requests ?? 0, prompt_tokens: r?.prompt_tokens ?? 0, completion_tokens: r?.completion_tokens ?? 0 };
      });
      const today = history[history.length - 1]!;
      const k = check?.key;
      const resets = new Date(`${addDays(day, 1)}T00:00:00Z`).toISOString();
      return c.json(
        {
          day,
          budget: today.requests + remaining,
          used: today.requests,
          remaining: Math.max(0, remaining),
          resets_at: resets,
          tokens: { prompt: today.prompt_tokens, completion: today.completion_tokens, total: today.prompt_tokens + today.completion_tokens },
          history,
          key: {
            status: k?.status ?? 'unreachable',
            label: k?.status === 'ok' ? k.label : null,
            free_tier: k?.status === 'ok' ? k.free_tier : null,
            usage: k?.status === 'ok' ? k.usage : null,
            limit: k?.status === 'ok' ? k.limit : null,
            limit_remaining: k?.status === 'ok' ? k.limit_remaining : null,
            error: k && (k.status === 'invalid' || k.status === 'unreachable') ? k.error : null,
          },
          models: models.map((m) => ({
            model_id: m.model_id,
            priority: m.priority,
            enabled: m.enabled,
            health_disabled: m.health_disabled,
            cooling_until: m.unhealthy_until && Date.parse(m.unhealthy_until) > now.getTime() ? m.unhealthy_until : null,
            success_count: m.success_count,
            fail_count: m.fail_count,
            avg_latency_ms: m.avg_latency_ms,
            last_error: m.last_error,
          })),
        },
        200,
      );
    },
  );
}
