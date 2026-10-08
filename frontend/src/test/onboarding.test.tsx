import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { longDate, todayIn } from '@/lib/format';
import { Onboarding } from '@/routes/Onboarding';
import en from '../../locales/en.json';
import obEn from '../../locales/extra/onboarding.en.json';
import { mockApi, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 't' }));
const push = vi.hoisted(() => ({ enablePush: vi.fn(async () => 'needs-install' as const), isIos: () => true }));
vi.mock('@/lib/push', () => push);

const step = (n: number) => en.onboarding.step.replace('{{current}}', String(n)).replace('{{total}}', '8');
const next = () => fireEvent.click(screen.getByRole('button', { name: en.common.next }));

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await act(() => i18n.changeLanguage('en'));
});

it('walks through every step and posts the onboarding body', async () => {
  const calls = mockApi({ 'POST /me/onboarding': { ok: true } });
  renderPage(<Onboarding />, { route: '/onboarding', path: '/onboarding' });

  // 1. language
  expect(screen.getByText(step(1))).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: en.onboarding.replyTanglish }));
  next();

  // 2. companion
  expect(screen.getByText(step(2))).toBeTruthy();
  const name = screen.getByLabelText(en.onboarding.companionName);
  expect(name.getAttribute('maxlength')).toBe('30');
  fireEvent.change(name, { target: { value: 'Thozhi' } });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(en.persona.calm) }));
  fireEvent.click(screen.getByRole('button', { name: en.onboarding.addressRespectful }));
  next();

  // 3. calories (hidden by default)
  expect(screen.getByRole('button', { name: en.onboarding.caloriesHide }).getAttribute('aria-pressed')).toBe('true');
  next();

  // 4. cycle: pick the 1st of this month, cycle length 32
  const first = `${todayIn().slice(0, 7)}-01`;
  fireEvent.click(screen.getByRole('button', { name: longDate(first) }));
  expect(screen.getByText(obEn.onboardingPage.selectedDate.replace('{{date}}', longDate(first)))).toBeTruthy();
  const plus = screen.getByRole('button', { name: `${en.onboarding.cycleLength} +` });
  fireEvent.click(plus);
  fireEvent.click(plus);
  expect(screen.getByText('32 days')).toBeTruthy();
  next();

  // 5. medicines
  fireEvent.click(screen.getByRole('button', { name: `+ ${en.meds.add}` }));
  fireEvent.change(screen.getByLabelText(en.meds.name), { target: { value: 'Metformin' } });
  fireEvent.change(screen.getByLabelText(en.meds.dose), { target: { value: '500 mg' } });
  fireEvent.click(screen.getByRole('button', { name: `+ ${en.meds.addTime}` }));
  fireEvent.change(screen.getByLabelText('Time 1'), { target: { value: '20:00' } });
  next();

  // 6. check-ins + notifications
  const morning = screen.getByLabelText(en.onboarding.morning) as HTMLInputElement;
  expect(morning.value).toBe('08:30');
  fireEvent.change(morning, { target: { value: '07:45' } });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(en.onboarding.notificationsAllow) }));
  expect(await screen.findByText(obEn.onboardingPage.pushNeedsInstall)).toBeTruthy();
  expect(push.enablePush).toHaveBeenCalled();
  next();

  // 7. install tip
  expect(screen.getByText(obEn.onboardingPage.installTitle)).toBeTruthy();
  next();

  // 8. privacy + finish
  expect(screen.getByText(en.onboarding.privacyBody)).toBeTruthy();
  expect(screen.getByText(en.common.disclaimer)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: en.onboarding.finish }));

  expect(await screen.findByText('other page')).toBeTruthy();
  const body = calls.find((c) => c.method === 'POST' && c.path === '/me/onboarding')?.body as {
    profile: Record<string, unknown>;
    medications: unknown;
    last_period_start: string | null;
  };
  expect(body.profile).toMatchObject({
    display_language: 'tanglish',
    ui_language: 'en',
    companion_name: 'Thozhi',
    persona_tone: 'calm',
    tamil_address_form: 'respectful',
    calorie_display: 'hide',
    typical_cycle_length: 32,
    morning_checkin: '07:45',
    evening_checkin: '21:00',
  });
  expect(typeof body.profile.timezone).toBe('string');
  expect(body.medications).toEqual([{ name: 'Metformin', dose: '500 mg', schedule_times: ['20:00'] }]);
  expect(body.last_period_start).toBe(first);
});

it('blocks Next on an invalid check-in time and shows errors on failed save', async () => {
  mockApi({ 'POST /me/onboarding': { __status: 500, body: { error: 'boom' } } });
  renderPage(<Onboarding />, { route: '/onboarding', path: '/onboarding' });
  for (let i = 0; i < 5; i++) next();
  expect(screen.getByText(step(6))).toBeTruthy();
  fireEvent.change(screen.getByLabelText(en.onboarding.evening), { target: { value: '' } });
  expect(screen.getByText(en.settings.invalidTime)).toBeTruthy();
  expect((screen.getByRole('button', { name: en.common.next }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(en.onboarding.evening), { target: { value: '21:30' } });
  next();
  next();
  fireEvent.click(screen.getByRole('button', { name: en.onboarding.finish }));
  expect(await screen.findByText(en.common.error)).toBeTruthy();
  expect(screen.queryByText('other page')).toBeNull();
});

it('not sure: skipping the date and cycle length sends nulls', async () => {
  const calls = mockApi({ 'POST /me/onboarding': { ok: true } });
  renderPage(<Onboarding />, { route: '/onboarding', path: '/onboarding' });
  next();
  next();
  next();
  fireEvent.click(screen.getByRole('button', { name: en.common.notSure }));
  for (let i = 0; i < 4; i++) next();
  fireEvent.click(screen.getByRole('button', { name: en.onboarding.finish }));
  expect(await screen.findByText('other page')).toBeTruthy();
  const body = calls.find((c) => c.path === '/me/onboarding')?.body as { profile: { typical_cycle_length: unknown; companion_name: string }; last_period_start: unknown; medications: unknown[] };
  expect(body.profile.typical_cycle_length).toBeNull();
  expect(body.profile.companion_name).toBe('Companion');
  expect(body.last_period_start).toBeNull();
  expect(body.medications).toEqual([]);
});

it('switching the app language to Tamil re-renders in Tamil', async () => {
  mockApi({});
  renderPage(<Onboarding />, { route: '/onboarding', path: '/onboarding' });
  expect(screen.getByText(en.onboarding.languageTitle)).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: en.settings.tamil }));
  });
  expect(await screen.findByText('உனக்கு எந்த மொழி பிடிக்கும்?')).toBeTruthy();
  for (const s of [en.onboarding.languageTitle, en.common.next, en.onboarding.replyAuto]) expect(screen.queryByText(s)).toBeNull();
  expect(screen.getByText('படி 1 / 8')).toBeTruthy();
});
