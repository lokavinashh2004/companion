// Display name greeting, reminders (bell + nudge card), avatar menu, chat panel controls and dish pictures.
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { TopBar } from '@/components/shell/TopBar';
import { dishArt, mealArt } from '@/components/today/dish';
import i18n from '@/i18n';
import type { Today as TodayData } from '@/lib/api';
import { useChatSound } from '@/lib/chime';
import { todayReminders } from '@/lib/reminders';
import { Settings } from '@/routes/Settings';
import { Today } from '@/routes/Today';
import { ME, mockApi, PROFILE, renderPage } from './utils';

const fb = vi.hoisted(() => ({ idToken: async () => 'token', signOut: vi.fn(async () => {}) }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => fb);
vi.mock('@/lib/push', () => ({ pushState: async () => 'off', enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn(), isIos: () => false, isStandalone: () => false }));

const DAY = '2026-10-08';
const TODAY = {
  day: DAY,
  calorie_display: 'hide',
  status: { kind: 'cycle', cycle_day: 12, period_day: null, days_late: null, phase: 'follicular' },
  prediction: { earliest: '2026-10-10', likely: '2026-10-12', latest: '2026-10-15', confidence: 'low', cycles_used: 2 },
  foods: [{ id: 'f1', day: DAY, meal: 'breakfast', item_name: 'Idli', quantity: 3, unit: 'pieces', grams: 150, kcal: 120, protein_g: 6, carbs_g: 24, fiber_g: 2, added_sugar_g: 0, veg_g: 0, gi_band: 'medium', is_estimate: true, source: 'text' }],
  score: { score: 7, highlights: [], idea: null, kcal: 120 },
  moods: [],
  symptoms: [],
  lifestyle: { water_ml: 250, sleep_hours: null, exercise_minutes: null, steps: null },
  meds: [{ medication: { id: 'med1', name: 'Metformin', dose: '500 mg', schedule_times: ['08:00', '20:00'], active: true, start_date: null, end_date: null }, doses: [{ time: '08:00', taken: false }, { time: '20:00', taken: false }] }],
  weight_due: false,
} as unknown as TodayData;

const at = (h: number, m = 0) => new Date(2026, 9, 8, h, m);

beforeEach(async () => {
  vi.clearAllMocks();
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('reminders', () => {
  it('flags missed doses, a water nudge when behind pace, and the period window', () => {
    const kinds = todayReminders(TODAY, at(14)).map((r) => r.kind);
    expect(kinds).toEqual(['dose_missed', 'water_behind', 'period_soon', 'dose_due']);
  });

  it('stays quiet early in the morning and celebrates a met water goal', () => {
    const early = todayReminders({ ...TODAY, meds: [], lifestyle: { ...TODAY.lifestyle!, water_ml: 0 } }, at(7));
    expect(early.map((r) => r.kind)).toEqual(['period_soon']);
    const done = todayReminders({ ...TODAY, meds: [], prediction: null, lifestyle: { ...TODAY.lifestyle!, water_ml: 2500 } }, at(18));
    expect(done.map((r) => r.kind)).toEqual(['water_goal']);
  });
});

describe('dish pictures', () => {
  it('matches English, Tanglish and Tamil names, with a meal fallback', () => {
    expect(dishArt('Idli')).toBe('🍥');
    expect(dishArt('sambar sadam')).toBe('🍲');
    expect(dishArt('தோசை')).toBe('🫓');
    expect(dishArt('mystery thing')).toBeNull();
    expect(mealArt('dinner', ['mystery thing'])).toBe('🍲');
  });
});

describe('Today', () => {
  it('greets her by name and shows a nudge card with an action', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(9));
    const calls = mockApi({ 'GET /me': { ...ME, profile: { ...PROFILE, display_name: 'Priya' } }, 'GET /today': TODAY, 'POST /meds/{id}/dose': { ok: true } });
    renderPage(<Today />);
    expect(await screen.findByRole('heading', { level: 1, name: /Good morning, Priya/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Metformin 500 mg not taken yet' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark taken' }));
    await waitFor(() => expect(calls.find((c) => c.path === '/meds/med1/dose')?.body).toEqual({ day: DAY, time: '08:00', taken: true }));
  });

  it('greets without a name when none is set', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(19));
    mockApi({ 'GET /me': ME, 'GET /today': TODAY });
    renderPage(<Today />);
    expect(await screen.findByRole('heading', { level: 1, name: /^Good evening ☀️$/ })).toBeTruthy();
  });
});

describe('top bar', () => {
  it('bell lists today’s reminders with a count', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(14));
    mockApi({ 'GET /me': ME, 'GET /today': TODAY });
    renderPage(<TopBar />);
    const bell = await screen.findByRole('button', { name: 'Reminders: 3 need attention' });
    fireEvent.click(bell);
    expect(screen.getByText('Metformin 500 mg not taken yet')).toBeTruthy();
    expect(screen.getByText('Time for some water')).toBeTruthy();
    expect(screen.getByText('Your period may start in 2 days')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Time for some water')).toBeNull();
  });

  it('avatar menu links to Me and Settings, switches theme and signs out', async () => {
    mockApi({ 'GET /me': { ...ME, profile: { ...PROFILE, display_name: 'Priya' } }, 'GET /today': TODAY });
    renderPage(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Your account' }));
    expect(await screen.findByText('Priya')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Me/ }).getAttribute('href')).toBe('/me');
    expect(screen.getByRole('link', { name: /Settings/ }).getAttribute('href')).toBe('/me/settings');
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: /Sign out/ }));
    expect(fb.signOut).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Your account' }));
    fireEvent.click(screen.getByRole('button', { name: 'System' }));
  });
});

describe('chat panel controls', () => {
  it('mute toggles and minimise closes the panel', async () => {
    useChatSound.setState({ muted: false });
    mockApi({ 'GET /me': ME, 'GET /chat/messages': { has_more: false, messages: [] } });
    const onClose = vi.fn();
    renderPage(<ChatPanel variant="panel" onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mute reply sound' }));
    expect(useChatSound.getState().muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Turn reply sound on' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Minimise chat' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('settings', () => {
  it('saves and clears the display name', async () => {
    const calls = mockApi({ 'GET /me': { ...ME, profile: { ...PROFILE, display_name: 'Priya' } }, 'PATCH /me': (b: unknown) => ({ ...PROFILE, ...(b as object) }) });
    renderPage(<Settings />);
    const field = (await screen.findByLabelText(/What should I call you/)) as HTMLInputElement;
    expect(field.value).toBe('Priya');
    fireEvent.change(field, { target: { value: '  ' } });
    fireEvent.blur(field);
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ display_name: null }));
  });
});
