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
import { Today } from '@/routes/Today';
import { Insights } from '@/routes/Insights';

const DAY = '2026-10-08';
const food = (o: Record<string, unknown>) => ({ id: 'f1', day: DAY, meal: 'breakfast', item_name: 'Idli', quantity: 3, unit: 'pieces', grams: 150, kcal: 120, protein_g: 6, carbs_g: 24, fiber_g: 2, added_sugar_g: 0, veg_g: 0, gi_band: 'medium', is_estimate: true, source: 'text', ...o });
const PROFILE = { companion_name: 'Companion', display_name: 'Priya', display_language: 'auto', ui_language: 'en', persona_tone: 'bestie', tamil_address_form: 'casual', calorie_display: 'hide', goals: [], diet_type: null, allergies: [], typical_cycle_length: null, onboarding_done: true, timezone: 'Asia/Kolkata', morning_checkin: '08:30', evening_checkin: '21:00', quiet_start: '22:30', quiet_end: '07:30', water_nudges: false, weight_tracking: false };
const ROUTES: Record<string, unknown> = {
  'GET /me': { uid: 'u1', email: 'priya@test', profile: PROFILE },
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
  const out = ROUTES[req.method + ' ' + url.pathname];
  return new Response(JSON.stringify(out ?? { error: 'not_found' }), { status: out ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Chat /> },
      { path: '/today', element: <Today /> },
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
