import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ idToken: async () => 'firebase-id-token' }));

afterEach(() => vi.unstubAllGlobals());

it('sends the Firebase ID token to the backend and unwraps the response', async () => {
  const seen: Request[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: Request) => {
      seen.push(req);
      return new Response(JSON.stringify({ ok: true, version: '0.1.0' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
  const { api, unwrap, API_URL } = await import('@/lib/api');
  const data = unwrap(await api.GET('/health'));
  expect(data).toEqual({ ok: true, version: '0.1.0' });
  expect(seen[0]!.url).toBe(`${API_URL}/health`);
  expect(seen[0]!.headers.get('Authorization')).toBe('Bearer firebase-id-token');
});

it('turns API errors into ApiError with the status', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })));
  const { api, unwrap, ApiError } = await import('@/lib/api');
  const r = await api.GET('/me');
  expect(() => unwrap(r)).toThrow(ApiError);
  try {
    unwrap(r);
  } catch (e) {
    expect((e as InstanceType<typeof ApiError>).status).toBe(401);
  }
});
