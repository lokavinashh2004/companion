import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import type { ChatMessage } from '@/lib/api';
import { Chat } from '@/routes/Chat';
import en from '../../locales/en.json';
import chatEn from '../../locales/extra/chat.en.json';
import { ME, mockApi, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 't' }));
vi.mock('@/components/chat/image', () => ({ fileToJpegBase64: vi.fn(async () => 'BASE64DATA') }));

const msg = (over: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role' | 'content'>): ChatMessage => ({
  created_at: `2026-10-08T10:00:0${over.id.length % 10}.000Z`,
  status: 'done',
  meta: {},
  ...over,
});

const HISTORY = {
  messages: [
    msg({ id: 'm1', role: 'user', content: 'I ate idli', created_at: '2026-10-08T08:00:00.000Z' }),
    msg({
      id: 'm2',
      role: 'assistant',
      content: 'Nice breakfast!',
      created_at: '2026-10-08T08:00:05.000Z',
      meta: { logs: [{ table: 'food_logs', id: 'log1', label: 'idli' }] },
    }),
  ],
  has_more: false,
};

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('renders history, sends a message optimistically and shows the reply', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const calls = mockApi({
    'GET /me': { ...ME, profile: { ...ME.profile, companion_name: 'Thozhi' } },
    'GET /chat/messages': HISTORY,
    'POST /chat/messages': async (body: unknown) => {
      await gate;
      const b = body as { text: string };
      return {
        status: 'done',
        message: msg({ id: 'u2', role: 'user', content: b.text, created_at: '2026-10-08T09:00:00.000Z' }),
        reply: msg({ id: 'a2', role: 'assistant', content: 'So glad you told me 💛', created_at: '2026-10-08T09:00:02.000Z' }),
        notice: null,
        crisis: false,
      };
    },
  });
  renderPage(<Chat />);

  expect(await screen.findByText('I ate idli')).toBeTruthy();
  expect(screen.getByText('Nice breakfast!')).toBeTruthy();
  expect(await screen.findByRole('heading', { name: 'Thozhi' })).toBeTruthy();

  const box = screen.getByRole('textbox', { name: en.chat.placeholder });
  fireEvent.change(box, { target: { value: 'Had a walk today' } });
  fireEvent.keyDown(box, { key: 'Enter' });

  expect(await screen.findByText('Had a walk today')).toBeTruthy();
  expect(screen.getByText(en.chat.sending)).toBeTruthy();
  expect(screen.getByText(en.chat.typing)).toBeTruthy();
  expect(screen.getByTestId('typing')).toBeTruthy(); // the three-dot bubble on the companion's side
  expect((box as HTMLTextAreaElement).value).toBe('');

  release();
  expect(await screen.findByText('So glad you told me 💛')).toBeTruthy();
  expect(screen.queryByText(en.chat.sending)).toBeNull();
  expect(screen.queryByTestId('typing')).toBeNull();

  const post = calls.find((c) => c.method === 'POST' && c.path === '/chat/messages');
  const body = post?.body as { text: string; client_id: string };
  expect(body.text).toBe('Had a walk today');
  expect(body.client_id).toMatch(/^[0-9a-f-]{36}$/);
});

it('Shift+Enter does not send', async () => {
  const calls = mockApi({ 'GET /me': ME, 'GET /chat/messages': HISTORY });
  renderPage(<Chat />);
  const box = await screen.findByRole('textbox', { name: en.chat.placeholder });
  fireEvent.change(box, { target: { value: 'line one' } });
  fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
  expect(calls.some((c) => c.method === 'POST')).toBe(false);
});

it('undo chip calls /chat/undo and shows the removed state', async () => {
  const calls = mockApi({
    'GET /me': ME,
    'GET /chat/messages': HISTORY,
    'POST /chat/undo': () => ({ message: { ...HISTORY.messages[1], meta: { ...HISTORY.messages[1]!.meta, undone: { log1: true } } } }),
  });
  renderPage(<Chat />);
  expect(await screen.findByText('Logged: idli')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Undo: idli' }));
  expect(await screen.findByText(chatEn.chatPage.removed.replace('{{label}}', 'idli'))).toBeTruthy();
  expect(calls.find((c) => c.path === '/chat/undo')?.body).toEqual({ message_id: 'm2', log_id: 'log1' });
});

it('confirm-period chip calls /chat/confirm-period, then offers undo', async () => {
  const withPending = msg({
    id: 'm3',
    role: 'assistant',
    content: 'Want me to log it?',
    created_at: '2026-10-08T08:10:00.000Z',
    meta: { pending: [{ kind: 'period_start', date: '2026-10-07', flow: null, pain: null }] },
  });
  const calls = mockApi({
    'GET /me': ME,
    'GET /chat/messages': { messages: [withPending], has_more: false },
    'POST /chat/confirm-period': () => ({ message: { ...withPending, meta: { ...withPending.meta, confirmed: { '0': 'p1' } } } }),
    'POST /chat/undo-period': () => ({ message: withPending }),
  });
  renderPage(<Chat />);
  fireEvent.click(await screen.findByRole('button', { name: /Log period start on 7 Oct/ }));
  expect(await screen.findByText(/Period logged for 7 Oct/)).toBeTruthy();
  expect(calls.find((c) => c.path === '/chat/confirm-period')?.body).toEqual({ message_id: 'm3', index: 0 });

  fireEvent.click(screen.getByRole('button', { name: /Undo: Period logged/ }));
  expect(await screen.findByRole('button', { name: /Log period start on 7 Oct/ })).toBeTruthy();
  expect(calls.some((c) => c.path === '/chat/undo-period')).toBe(true);
});

it('shows the crisis card when the send result has crisis:true, and it can be dismissed', async () => {
  mockApi({
    'GET /me': ME,
    'GET /chat/messages': { messages: [], has_more: false },
    'POST /chat/messages': (body: unknown) => ({
      status: 'done',
      message: msg({ id: 'u9', role: 'user', content: (body as { text: string }).text, created_at: '2026-10-08T09:00:00.000Z' }),
      reply: msg({ id: 'a9', role: 'assistant', content: 'I am here with you.', created_at: '2026-10-08T09:00:01.000Z' }),
      notice: null,
      crisis: true,
    }),
  });
  renderPage(<Chat />);
  expect(await screen.findByText(en.chat.emptyTitle)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: en.chat.quickLow }));

  expect(await screen.findByText(en.chat.crisisTitle)).toBeTruthy();
  const call = screen.getByRole('link', { name: en.a11y.callHelpline });
  expect(call.getAttribute('href')).toBe('tel:14416');
  // The chat stays usable.
  expect(screen.getByRole('textbox', { name: en.chat.placeholder })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: en.chat.crisisDismiss }));
  expect(screen.queryByText(en.chat.crisisTitle)).toBeNull();
});

it('shows the queued notice softly and marks the message as queued', async () => {
  mockApi({
    'GET /me': ME,
    'GET /chat/messages': { messages: [], has_more: false },
    'POST /chat/messages': (body: unknown) => ({
      status: 'queued',
      message: msg({ id: 'u5', role: 'user', content: (body as { text: string }).text, status: 'queued', created_at: '2026-10-08T09:00:00.000Z' }),
      reply: null,
      notice: msg({ id: 'n5', role: 'assistant', content: 'Busy right now, I will reply soon.', created_at: '2026-10-08T09:00:01.000Z', meta: { fallback: true } }),
      crisis: false,
    }),
  });
  renderPage(<Chat />);
  const box = await screen.findByRole('textbox', { name: en.chat.placeholder });
  fireEvent.change(box, { target: { value: 'hello' } });
  fireEvent.click(screen.getByRole('button', { name: en.a11y.sendMessage }));
  expect(await screen.findByText('Busy right now, I will reply soon.')).toBeTruthy();
  expect(screen.getByText(en.chat.queued)).toBeTruthy();
});

it('keeps the text in the composer when sending fails', async () => {
  mockApi({
    'GET /me': ME,
    'GET /chat/messages': { messages: [], has_more: false },
    'POST /chat/messages': { __status: 500, body: { error: 'boom' } },
  });
  renderPage(<Chat />);
  const box = await screen.findByRole('textbox', { name: en.chat.placeholder });
  fireEvent.change(box, { target: { value: 'please keep me' } });
  fireEvent.keyDown(box, { key: 'Enter' });
  expect(await screen.findByText(en.common.error)).toBeTruthy();
  expect((box as HTMLTextAreaElement).value).toBe('please keep me');
});

it('holds the message while offline', async () => {
  const calls = mockApi({ 'GET /me': ME, 'GET /chat/messages': { messages: [], has_more: false } });
  const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  try {
    renderPage(<Chat />);
    const box = await screen.findByRole('textbox', { name: en.chat.placeholder });
    fireEvent.change(box, { target: { value: 'later please' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await screen.findByText(en.common.offline)).toBeTruthy();
    expect((box as HTMLTextAreaElement).value).toBe('later please');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  } finally {
    spy.mockRestore();
  }
});

it('loads earlier messages', async () => {
  const calls = mockApi({
    'GET /me': ME,
    'GET /chat/messages': (_b: unknown, url: URL) =>
      url.searchParams.get('before')
        ? { messages: [msg({ id: 'old1', role: 'assistant', content: 'An older hello', created_at: '2026-10-01T08:00:00.000Z' })], has_more: false }
        : { ...HISTORY, has_more: true },
  });
  renderPage(<Chat />);
  fireEvent.click(await screen.findByRole('button', { name: chatEn.chatPage.loadEarlier }));
  expect(await screen.findByText('An older hello')).toBeTruthy();
  expect(calls.find((c) => c.url.searchParams.get('before'))?.url.searchParams.get('before')).toBe('2026-10-08T08:00:00.000Z');
  await waitFor(() => expect(screen.queryByRole('button', { name: chatEn.chatPage.loadEarlier })).toBeNull());
  const items = within(screen.getByRole('log')).getAllByRole('listitem');
  expect(items[0]?.textContent).toContain('An older hello');
});

it('food photo: detects items, lets her edit, and saves only on Save', async () => {
  const calls = mockApi({
    'GET /me': ME,
    'GET /chat/messages': { messages: [], has_more: false },
    'POST /food/photo': { status: 'ok', is_food: true, items: [{ name: 'Dosa', quantity: 2, unit: 'pc', estimated_grams: 160 }, { name: 'Chutney', quantity: 1, unit: 'bowl', estimated_grams: 50 }] },
    'POST /food/logs': { logs: [] },
  });
  renderPage(<Chat />);
  fireEvent.click(await screen.findByRole('button', { name: en.a11y.openCamera }));
  expect(screen.getByText(en.photo.privacy)).toBeTruthy();
  const input = screen.getByLabelText(new RegExp(en.photo.pickCamera));
  expect(input.getAttribute('capture')).toBe('environment');
  fireEvent.change(input, { target: { files: [new File(['x'], 'plate.jpg', { type: 'image/jpeg' })] } });

  expect(await screen.findByDisplayValue('Dosa')).toBeTruthy();
  expect(calls.find((c) => c.path === '/food/photo')?.body).toMatchObject({ image_base64: 'BASE64DATA' });
  expect(calls.some((c) => c.path === '/food/logs')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: 'Remove Chutney' }));
  fireEvent.click(screen.getByRole('button', { name: en.meals.lunch }));
  fireEvent.click(screen.getByRole('button', { name: en.photo.save }));
  expect(await screen.findByText(en.photo.saved)).toBeTruthy();
  const saved = calls.find((c) => c.path === '/food/logs')?.body as { items: unknown[]; meal: string; source: string; day: string };
  expect(saved.items).toEqual([{ name: 'Dosa', quantity: 2, unit: 'pc', grams: 160 }]);
  expect(saved.meal).toBe('lunch');
  expect(saved.source).toBe('photo');
  expect(saved.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it('photo: handles not-food and unavailable', async () => {
  let result: unknown = { status: 'ok', is_food: false, items: [] };
  mockApi({ 'GET /me': ME, 'GET /chat/messages': { messages: [], has_more: false }, 'POST /food/photo': () => result });
  renderPage(<Chat />);
  fireEvent.click(await screen.findByRole('button', { name: en.a11y.openCamera }));
  fireEvent.change(screen.getByLabelText(new RegExp(en.photo.pickLibrary)), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
  expect(await screen.findByText(en.photo.notFood)).toBeTruthy();
  result = { status: 'unavailable', is_food: false, items: [] };
  fireEvent.change(screen.getByLabelText(new RegExp(en.photo.pickLibrary)), { target: { files: [new File(['y'], 'b.jpg', { type: 'image/jpeg' })] } });
  expect(await screen.findByText(en.photo.unavailable)).toBeTruthy();
});

it('renders Tamil strings when the UI language is Tamil', async () => {
  mockApi({ 'GET /me': ME, 'GET /chat/messages': { messages: [], has_more: false } });
  await act(() => i18n.changeLanguage('ta'));
  renderPage(<Chat />);
  expect(await screen.findByText('ஹாய் சொல்லு 👋')).toBeTruthy();
  for (const s of [en.chat.emptyTitle, en.chat.emptyBody, en.chat.quickFood, en.chat.quickPeriod, en.chat.quickLow]) expect(screen.queryByText(s)).toBeNull();
  expect(screen.getByRole('textbox', { name: 'மெசேஜ்…' })).toBeTruthy();
  await act(() => i18n.changeLanguage('en'));
});
