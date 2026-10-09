// The HTTP app, built from injected dependencies so tests can run it with an in-memory store and fakes.
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';

import { HealthSchema } from './contract.ts';
import { registerChat } from './routes/chat.ts';
import { registerCycle } from './routes/cycle.ts';
import { registerFood } from './routes/food.ts';
import { registerInsights } from './routes/insights.ts';
import { registerProfile } from './routes/profile.ts';
import { registerPush } from './routes/push.ts';
import { registerRecords } from './routes/records.ts';
import { ensureUser, jsonRes, type AppDeps, type AppEnv } from './routes/shared.ts';
import { registerToday } from './routes/today.ts';

export const VERSION = '0.2.0';
export type { AppDeps, AppEnv };

// Everything needs a Firebase token except these (jobs use the cron secret, med-action a signed token).
const PUBLIC = [/^\/health$/, /^\/openapi\.json$/, /^\/jobs\//, /^\/med-action$/];

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({
    // Zod validation errors → 400 with a short message (no request echo).
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: 'invalid_request' }, 400);
    },
  });

  // CORS first, so every response (preflights, 401s, 404s, errors) carries the headers for allowed origins.
  // Auth is a Bearer token, not cookies; credentials stay on so the exact origin is always echoed, never '*'.
  app.use(
    '*',
    cors({
      origin: (origin) => (deps.allowedOrigins.includes(origin) ? origin : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      maxAge: 600,
    }),
  );
  app.use('*', secureHeaders());
  // Photos are downscaled to 1024 px in the browser; 4 MB is plenty.
  app.use('*', bodyLimit({ maxSize: 4 * 1024 * 1024, onError: (c) => c.json({ error: 'too_large' }, 413) }));
  // Request log without bodies or query strings (no health data in logs).
  app.use('*', async (c, next) => {
    const t0 = Date.now();
    await next();
    // Route pattern (e.g. /food/logs/:id) when one matched; else the bare path, still without the query string.
    const route = c.req.routePath === '/*' ? c.req.path : c.req.routePath;
    if (c.req.path !== '/health') console.log(`${c.req.method} ${route} ${c.res.status} ${Date.now() - t0}ms`);
  });

  const requireUser = createMiddleware<AppEnv>(async (c, next) => {
    const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HTTPException(401, { message: 'unauthorized' });
    let user;
    try {
      user = await deps.auth.verifyToken(token);
    } catch {
      throw new HTTPException(401, { message: 'unauthorized' });
    }
    await ensureUser(deps.services, user.uid, user.email);
    c.set('uid', user.uid);
    c.set('email', user.email);
    await next();
  });
  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS' || PUBLIC.some((re) => re.test(c.req.path))) return next();
    return requireUser(c, next);
  });

  app.openapi(
    createRoute({ method: 'get', path: '/health', tags: ['system'], responses: { 200: jsonRes(HealthSchema, 'Service is up') } }),
    (c) => c.json({ ok: true as const, version: VERSION, store: deps.services.store.kind }, 200),
  );

  registerProfile(app, deps);
  registerChat(app, deps);
  registerFood(app, deps);
  registerToday(app, deps);
  registerCycle(app, deps);
  registerRecords(app, deps);
  registerInsights(app, deps);
  registerPush(app, deps);

  app.openAPIRegistry.registerComponent('securitySchemes', 'firebase', { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' });
  app.doc31('/openapi.json', { openapi: '3.1.0', info: { title: 'Companion API', version: VERSION } });

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message || 'error' }, err.status);
    console.error('unhandled', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal' }, 500);
  });
  return app;
}

export type App = ReturnType<typeof createApp>;
