// Test helpers: render with providers, and a fake backend (stubs fetch by "METHOD /path").
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

export type Handler = (body: unknown, url: URL) => unknown | Promise<unknown>;

/**
 * Replaces fetch with a fake API. Keys look like 'GET /today' or 'POST /chat/messages' (path without query).
 * A handler may return a value (→ 200 JSON) or `{ __status: 4xx, body }`. Unknown routes return 404.
 * Returns the list of calls for assertions.
 */
export function mockApi(routes: Record<string, Handler | unknown>) {
  const calls: { method: string; path: string; body: unknown; url: URL }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request | string, init?: RequestInit) => {
      const req = typeof input === 'string' ? new Request(input, init) : input;
      const url = new URL(req.url);
      const text = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.clone().text();
      const body = text ? (JSON.parse(text) as unknown) : undefined;
      calls.push({ method: req.method, path: url.pathname, body, url });
      const exact = routes[`${req.method} ${url.pathname}`];
      const pattern = Object.entries(routes).find(([k]) => {
        const [m, p] = k.split(' ');
        return m === req.method && p && new RegExp(`^${p.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(url.pathname);
      })?.[1];
      const h = exact ?? pattern;
      if (h === undefined) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      const out = typeof h === 'function' ? await (h as Handler)(body, url) : h;
      const status = (out as { __status?: number })?.__status ?? 200;
      const payload = (out as { __status?: number; body?: unknown })?.__status ? (out as { body?: unknown }).body : out;
      return new Response(JSON.stringify(payload ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
  return calls;
}

export function renderPage(ui: ReactElement, { route = '/', path = '*' }: { route?: string; path?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<p>other page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A complete profile for tests (onboarded, English, calories hidden). */
export const PROFILE = {
  companion_name: 'Companion',
  display_name: null,
  display_language: 'auto',
  ui_language: 'en',
  persona_tone: 'bestie',
  tamil_address_form: 'casual',
  calorie_display: 'hide',
  goals: [],
  diet_type: null,
  allergies: [],
  typical_cycle_length: null,
  onboarding_done: true,
  timezone: 'Asia/Kolkata',
  morning_checkin: '08:30',
  evening_checkin: '21:00',
  quiet_start: '22:30',
  quiet_end: '07:30',
  water_nudges: false,
  weight_tracking: false,
} as const;

export const ME = { uid: 'u1', email: 'tester@companion.test', profile: PROFILE };
