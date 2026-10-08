// Typed client for the Render backend. Types come from backend/openapi.json (npm run api:types).
// Every request carries the Firebase ID token. Slow first requests (a sleeping free Render service) flip
// a "waking up" flag so the UI can explain the wait.
import createClient, { type Middleware } from 'openapi-fetch';
import { create } from 'zustand';

import type { components, paths } from './api-schema';
import { idToken } from './firebase';

type S = components['schemas'];
export type Profile = S['Profile'];
export type ProfilePatch = S['ProfilePatch'];
export type Me = S['Me'];
export type ChatMessage = S['ChatMessage'];
export type MessageMeta = S['MessageMeta'];
export type SendResult = S['SendResult'];
export type FoodLog = S['FoodLog'];
export type PhotoResult = S['PhotoResult'];
export type Today = S['Today'];
export type Cycle = S['Cycle'];
export type CycleStatus = S['CycleStatus'];
export type Prediction = S['Prediction'];
export type Period = S['Period'];
export type Insight = S['Insight'];
export type Insights = S['Insights'];
export type Medication = S['Medication'];
export type MedInput = S['MedInput'];
export type Lab = S['Lab'];
export type LabInput = S['LabInput'];
export type Fact = S['Fact'];
export type Onboarding = S['Onboarding'];
export type QuickLog = S['QuickLog'];
export type Meal = FoodLog['meal'];

export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787').replace(/\/$/, '');
export const WAKING_AFTER_MS = 4000;

export const useApiStatus = create<{ waking: boolean }>(() => ({ waking: false }));

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const authAndWake: Middleware = {
  async onRequest({ request }) {
    const token = await idToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    (request as Request & { _timer?: ReturnType<typeof setTimeout> })._timer = setTimeout(
      () => useApiStatus.setState({ waking: true }),
      WAKING_AFTER_MS,
    );
    return request;
  },
  onResponse({ request, response }) {
    clearTimeout((request as Request & { _timer?: ReturnType<typeof setTimeout> })._timer);
    useApiStatus.setState({ waking: false });
    return response;
  },
  onError({ request }) {
    clearTimeout((request as Request & { _timer?: ReturnType<typeof setTimeout> })._timer);
    useApiStatus.setState({ waking: false });
  },
};

// Late-bound fetch so tests (and any polyfill) can replace it after import.
export const api = createClient<paths>({ baseUrl: API_URL, fetch: (req) => globalThis.fetch(req) });
api.use(authAndWake);

/** Unwraps an openapi-fetch result or throws ApiError. */
export function unwrap<T>(r: { data?: T; error?: unknown; response: Response }): T {
  if (r.error !== undefined || r.data === undefined) {
    const msg = (r.error as { error?: string } | undefined)?.error ?? `http_${r.response.status}`;
    throw new ApiError(r.response.status, msg);
  }
  return r.data;
}
