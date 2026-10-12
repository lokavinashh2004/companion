import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { MoodGames } from '@/components/mood/MoodGames';
import i18n from '@/i18n';
import { mockApi, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token' }));

const DAY = '2026-10-08';
// Just under 1: the shuffle keeps the deck in order (pairs sit 6 apart), and kind words start at the last one.
const inOrder = () => 0.9999;

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const open = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  return within(await screen.findByRole('dialog'));
};

it('offers four games', async () => {
  mockApi({});
  renderPage(<MoodGames day={DAY} />);
  for (const name of ['Breathe', 'Bubble pop', 'Memory match', 'Kind words']) expect(screen.getByRole('button', { name: new RegExp(name) })).toBeTruthy();
});

it('memory match: keeps pairs, turns misses back over, and celebrates a win', async () => {
  mockApi({});
  renderPage(<MoodGames day={DAY} random={inOrder} />);
  const g = await open('Memory match');
  const card = (n: number) => g.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))[n]!;
  expect(g.getByText('0 of 6 pairs · 0 moves')).toBeTruthy();

  fireEvent.click(card(0));
  fireEvent.click(card(6));
  expect(g.getByText('1 of 6 pairs · 1 moves')).toBeTruthy();
  expect(card(0).getAttribute('aria-pressed')).toBe('true');

  fireEvent.click(card(1));
  fireEvent.click(card(2));
  expect(card(1).textContent).toBe('🌙');
  expect(card(2).textContent).toBe('🍓');
  await waitFor(() => expect(card(1).getAttribute('aria-pressed')).toBe('false'));
  expect(g.getByText('1 of 6 pairs · 2 moves')).toBeTruthy();

  for (let i = 1; i < 6; i++) {
    fireEvent.click(card(i));
    fireEvent.click(card(i + 6));
  }
  expect(g.getByText('All pairs found in 7 moves! 🎉')).toBeTruthy();
  fireEvent.click(g.getByRole('button', { name: 'Play again' }));
  expect(g.getByText('0 of 6 pairs · 0 moves')).toBeTruthy();
});

it('bubble pop counts pops', async () => {
  mockApi({});
  renderPage(<MoodGames day={DAY} />);
  const g = await open('Bubble pop');
  fireEvent.click(g.getByRole('button', { name: 'Pop bubble 1' }));
  fireEvent.click(g.getByRole('button', { name: 'Pop bubble 5' }));
  fireEvent.click(g.getByRole('button', { name: 'Pop bubble 5' })); // already popped
  expect(g.getByText('2 bubbles popped')).toBeTruthy();
});

it('breathing walks through in, hold, out and rest for four rounds', async () => {
  vi.useFakeTimers({ toFake: ['setInterval'] });
  mockApi({});
  renderPage(<MoodGames day={DAY} />);
  const g = await open('Breathe');
  fireEvent.click(g.getByRole('button', { name: 'Start' }));
  expect(g.getByText('Breathe in')).toBeTruthy();
  expect(g.getByText('4')).toBeTruthy();
  act(() => vi.advanceTimersByTime(4000));
  expect(g.getByText('Hold')).toBeTruthy();
  act(() => vi.advanceTimersByTime(4000));
  expect(g.getByText('Breathe out')).toBeTruthy();
  act(() => vi.advanceTimersByTime(8000));
  expect(g.getByText('Round 2 of 4')).toBeTruthy();
  act(() => vi.advanceTimersByTime(48_000));
  expect(g.getByText('Well done 🌿')).toBeTruthy();
  expect(g.getByRole('button', { name: 'Play again' })).toBeTruthy();
});

it('kind words shows another message on tap', async () => {
  mockApi({});
  renderPage(<MoodGames day={DAY} random={inOrder} />);
  const g = await open('Kind words');
  expect(g.getByText(/Today counts/)).toBeTruthy();
  fireEvent.click(g.getByRole('button', { name: 'Another one' }));
  expect(g.queryByText(/Today counts/)).toBeNull();
});

it('asks how she feels after a game and logs the mood', async () => {
  const calls = mockApi({ 'POST /today/quick-log': { ok: true } });
  renderPage(<MoodGames day={DAY} />);
  const g = await open('Kind words');
  fireEvent.click(g.getByRole('button', { name: 'Log mood 4 of 5' }));
  await waitFor(() => expect(calls.find((c) => c.path === '/today/quick-log')?.body).toEqual({ day: DAY, mood: 4 }));
  expect(await g.findByText(/Thanks for checking in/)).toBeTruthy();
});
