import '@fontsource-variable/anek-tamil/standard.css';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-600.css';
import '@fontsource/noto-sans/latin-700.css';
import '@/styles/global.css';
import '@/i18n';
import '@/lib/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Chat } from '@/routes/Chat';
import { Cycle } from '@/routes/Cycle';
import { Layout } from '@/routes/Layout';
import { Me } from '@/routes/Me';
import { Goals } from '@/routes/Goals';
import { Progress } from '@/routes/Progress';
import { Today } from '@/routes/Today';
import { TodaySection } from '@/routes/TodaySection';
import { Walks } from '@/routes/Walks';
import { Insights } from '@/routes/Insights';
import { Admin } from '@/routes/Admin';

const DAY = '2026-10-08';
const food = (o: Record<string, unknown>) => ({ id: 'f1', day: DAY, meal: 'breakfast', item_name: 'Idli', quantity: 3, unit: 'pieces', grams: 150, kcal: 120, protein_g: 6, carbs_g: 24, fiber_g: 2, added_sugar_g: 0, veg_g: 0, gi_band: 'medium', is_estimate: true, source: 'text', ...o });
const PROFILE = { companion_name: 'Companion', display_name: 'Priya', display_language: 'auto', ui_language: 'en', persona_tone: 'bestie', tamil_address_form: 'casual', calorie_display: 'hide', goals: [], diet_type: null, allergies: [], typical_cycle_length: null, onboarding_done: true, timezone: 'Asia/Kolkata', morning_checkin: '08:30', evening_checkin: '21:00', quiet_start: '22:30', quiet_end: '07:30', water_nudges: false, weight_tracking: false };
const ROUTES: Record<string, unknown> = {
  'GET /me': { uid: 'u1', email: 'priya@test', is_admin: true, profile: PROFILE },
  'GET /admin/usage': {
    day: '2026-10-09', budget: 50, used: 18, remaining: 32, resets_at: '2026-10-10T00:00:00.000Z',
    tokens: { prompt: 21040, completion: 3380, total: 24420 },
    history: Array.from({ length: 14 }, (_, i) => ({ day: `2026-09-${String(26 + i).padStart(2, '0')}`.replace(/09-3[1-9]/, (m) => `10-0${Number(m.slice(3)) - 30}`), requests: [12, 30, 22, 8, 41, 50, 19, 27, 33, 15, 9, 44, 36, 18][i]!, prompt_tokens: [9, 25, 18, 6, 33, 41, 15, 22, 27, 12, 7, 36, 29, 21][i]! * 1000, completion_tokens: [2, 4, 3, 1, 5, 6, 2, 3, 4, 2, 1, 5, 4, 3][i]! * 1000 })),
    key: { status: 'ok', label: 'companion', free_tier: true, usage: 0, limit: null, limit_remaining: null, error: null },
    models: [
      { model_id: 'nvidia/nemotron-3-ultra-550b-a55b:free', priority: 1, enabled: true, health_disabled: false, cooling_until: null, success_count: 40, fail_count: 2, avg_latency_ms: 2100, last_error: null },
      { model_id: 'nvidia/nemotron-3.5-lightning:free', priority: 3, enabled: true, health_disabled: false, cooling_until: '2026-10-09T12:30:00Z', success_count: 3, fail_count: 4, avg_latency_ms: 9800, last_error: 'timeout' },
      { model_id: 'nvidia/nemotron-3-super-120b-a12b:free', priority: 5, enabled: true, health_disabled: false, cooling_until: null, success_count: 12, fail_count: 0, avg_latency_ms: 591, last_error: null },
      { model_id: 'thinkingmachines/inkling:free', priority: 6, enabled: false, health_disabled: false, cooling_until: null, success_count: 0, fail_count: 3, avg_latency_ms: null, last_error: 'http_403: thinkingmachines/inkling:free is only available on agentic harnesses' },
    ],
  },
  'GET /today': {
    day: DAY,
    calorie_display: 'hide',
    status: { kind: 'cycle', cycle_day: 12, period_day: null, days_late: null, phase: 'follicular' },
    prediction: { earliest: '2026-10-24', likely: '2026-10-27', latest: '2026-10-31', confidence: 'low', cycles_used: 2 },
    foods: [food({}), food({ id: 'f2', meal: 'lunch', item_name: 'Sambar rice', quantity: 1, unit: 'plate', is_estimate: false })],
    score: { score: 7, highlights: ['protein'], idea: 'add_veggies', kcal: 520 },
    moods: [{ id: 'm1', mood: 4, energy: 3, stress: 2 }],
    symptoms: [{ id: 's1', symptom: 'bloating', severity: 2 }],
    lifestyle: { water_ml: 750, sleep_hours: 7.5, exercise_minutes: null, steps: null },
    meds: [{ medication: { id: 'med1', name: 'Metformin', dose: '500 mg', schedule_times: ['20:00'], active: true, start_date: null, end_date: null }, doses: [{ time: '20:00', taken: false }] }],
    weight_due: false,
    progress: { percent: 46, complete: false, food: { done: 2, goal: 3 }, water: { done: 750, goal: 2000 }, steps: { done: 2400, goal: 5000 } },
  },
  'GET /chat/messages': {
    has_more: false,
    messages: [
      { id: 'm0', role: 'assistant', content: 'Good morning! How did you sleep?', created_at: '2026-10-08T07:45:00.000Z', status: 'done', meta: {} },
      { id: 'm1', role: 'user', content: 'Had 2 idli and sambar for breakfast', created_at: '2026-10-08T08:00:00.000Z', status: 'done', meta: {} },
      { id: 'm2', role: 'assistant', content: 'Nice breakfast! I logged it for you.', created_at: '2026-10-08T08:00:05.000Z', status: 'done', meta: { logs: [{ table: 'food_logs', id: 'log1', label: '2 idli + sambar' }] } },
      { id: 'm3', role: 'user', content: 'I think my period started', created_at: '2026-10-08T08:42:00.000Z', status: 'done', meta: {} },
    ],
  },
  'GET /walks': (url: URL) => {
    const steps = [4200, 0, 6100, 5300, 2800, 7400, 5050, 0, 3900, 6600, 5200, 1800, 5600, 3100, 0, 4800, 6900, 5400, 2200, 0, 5800, 6300, 4100, 0, 5200, 5900, 6100, 3500, 5100, 2400];
    const days = steps.slice(-Number(url.searchParams.get('days') ?? 30)).map((n, i) => ({ day: new Date(Date.UTC(2026, 9, 8 - (Math.min(30, Number(url.searchParams.get('days') ?? 30)) - 1) + i)).toISOString().slice(0, 10), steps: n, duration_s: Math.round(n * 0.55), sessions: n ? 1 : 0 }));
    const sum = (k: 'steps' | 'duration_s' | 'sessions', xs = days) => xs.reduce((a, d) => a + d[k], 0);
    return {
      today: DAY, goal: 5000, weight_kg: null, days, streak: 0,
      totals: { steps: sum('steps'), duration_s: sum('duration_s'), sessions: sum('sessions'), active_days: days.filter((d) => d.sessions).length, goal_days: days.filter((d) => d.steps >= 5000).length },
      best: days.reduce((b, d) => (d.steps > b.steps ? d : b)), recent: [
        { id: 'w3', day: DAY, started_at: '2026-10-08T01:30:00Z', duration_s: 1320, steps: 2400 },
        { id: 'w2', day: '2026-10-07', started_at: '2026-10-07T12:10:00Z', duration_s: 2805, steps: 5100 },
        { id: 'w1', day: '2026-10-06', started_at: '2026-10-06T01:00:00Z', duration_s: 1925, steps: 3500 },
      ],
    };
  },
  'GET /progress': (url: URL) => {
    const month = url.searchParams.get('month') ?? '2026-10';
    const pct = [100, 67, 100, 100, 33, 0, 100, 83, 100, 100, 100, 50, 67, 100, 17, 100, 100, 83, 100, 100, 67, 100, 100, 100, 0, 33, 100, 100, 100, 100];
    const days = month === '2026-10'
      ? [100, 100, 67, 100, 100, 100, 100, 46].map((p, i) => ({ day: `2026-10-0${i + 1}`, percent: p, complete: p === 100, meals: p === 100 ? 3 : 2, water_ml: p === 100 ? 2000 : 750, steps: p === 100 ? 5300 : 2400 }))
      : month === '2026-09'
        ? pct.map((p, i) => ({ day: `2026-09-${String(i + 1).padStart(2, '0')}`, percent: p, complete: p === 100, meals: p === 100 ? 3 : 1, water_ml: p === 100 ? 2000 : 500, steps: p === 100 ? 5100 : 1500 }))
        : [];
    return { month, today: DAY, goals: { meals: 3, water_ml: 2000, steps: 5000 }, days, complete_days: days.filter((d) => d.complete).length, streak: 4 };
  },
  'GET /food/calories': {
    hidden: false, target: 1800, target_is_default: true,
    today: { day: DAY, kcal: 1240, by_meal: [{ meal: 'breakfast', kcal: 340 }, { meal: 'lunch', kcal: 900 }], unknown_items: 0 },
    week: { from: '2026-10-05', days: [1650, 2100, 1720, 1240].map((kcal, i) => ({ day: `2026-10-0${5 + i}`, kcal })), total: 6710, average: 1678 },
    month: { from: '2026-10-01', days: [1500, 1820, 1690, 1400, 1650, 2100, 1720, 1240].map((kcal, i) => ({ day: `2026-10-0${1 + i}`, kcal })), total: 13120, average: 1640 },
  },
  'GET /food/search': { results: [{ name: 'idli', kcal_per_100g: 146, serving_g: 120, piece_g: 40 }, { name: 'idiyappam', kcal_per_100g: 150, serving_g: 100, piece_g: 30 }] },
  'POST /food/estimate': { found: true, name: 'idli', grams: 120, kcal: 175, is_estimate: false },
  'GET /overview': {
    today: DAY, today_score: 46,
    week: { score: 68, previous: 55, change: 13, trend: 'up' },
    factors: [
      { key: 'meals', score: 76, previous: 62, trend: 'up' },
      { key: 'water', score: 71, previous: 69, trend: 'steady' },
      { key: 'steps', score: 48, previous: 57, trend: 'down' },
      { key: 'meds', score: 93, previous: 86, trend: 'up' },
      { key: 'checkin', score: 71, previous: 43, trend: 'up' },
      { key: 'sleep', score: 57, previous: 57, trend: 'steady' },
    ],
    days: Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.UTC(2026, 8, 9 + i)).toISOString().slice(0, 10), score: Math.round(45 + i * 0.8 + 12 * Math.sin(i / 2)) })),
    active_days: 27,
  },
  'GET /cycle': {
    today: DAY,
    status: { kind: 'cycle', cycle_day: 29, period_day: null, days_late: null, phase: 'luteal' },
    prediction: { earliest: '2026-10-05', likely: '2026-10-11', latest: '2026-10-18', confidence: 'medium', cycles_used: 3 },
    periods: [{ id: 'p1', start_date: '2026-09-10', end_date: '2026-09-14', flow: 'medium', pain: 3, auto_closed: false, length_days: 5, cycle_length: null }],
    insights: [{ id: 'i1', day: DAY, type: 'delay', payload: { days_late: 3, factors: ['high_stress', 'poor_sleep'] }, dismissed: false }],
  },
};
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Request | string, init?: RequestInit) => {
  const req = typeof input === 'string' ? new Request(input, init) : input;
  const url = new URL(req.url);
  if (url.port !== '8787') return realFetch(input, init);
  const route = ROUTES[req.method + ' ' + url.pathname];
  const out = typeof route === 'function' ? (route as (u: URL) => unknown)(url) : route;
  return new Response(JSON.stringify(out ?? { error: 'not_found' }), { status: out ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

const router = createBrowserRouter([
  { path: '/admin', element: <Admin /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Chat /> },
      { path: '/today', element: <Today /> },
      { path: '/today/walk', element: <Walks /> },
      { path: '/today/goals', element: <Goals /> },
      { path: '/me/progress', element: <Progress /> },
      { path: '/today/:section', element: <TodaySection /> },
      { path: '/cycle', element: <Cycle /> },
      { path: '/insights', element: <Insights /> },
      { path: '/me', element: <Me /> },
    ],
  },
]);
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
