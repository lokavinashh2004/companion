# PLAN: Companion as a website with separate frontend and backend

Status: **approved 2026-10-08. W0 is done (code). Deploys need your accounts.**

---

## 1. Decisions

| Topic | Decision |
|---|---|
| Product | The same bilingual PCOS companion (chat, food, cycle, memory, insights, doctor report), delivered as a website that installs like an app (PWA) |
| Repo layout | Only two folders, `frontend/` and `backend/`, deployed separately. The old Android app code was removed on 2026-10-08 (it's still in git history) |
| Frontend host | **Vercel** (free Hobby plan) |
| Backend host | **Render** (free web service) |
| Logins | **Firebase Authentication** (free Spark plan: email/password and Google sign-in) |
| Database | **MongoDB** (Atlas free M0). Changed from Supabase on 2026-10-08 at the owner's request. An in-memory store with the same behaviour is used for local development and tests |
| Scheduled jobs | **cron-job.org** (free) calls `POST /jobs/tick` every 5 minutes. Render has no free cron jobs. In local development the backend runs the same tick itself |
| Offline medicine "Taken" | Needs internet; nothing is queued in the browser |

---

## 2. Architecture

```
                 ┌───────────────────────────── Vercel ─────────────────────────────┐
  Browser / PWA  │ frontend/  React SPA (Vite) · Firebase Auth SDK · service worker   │
                 └───────────────┬──────────────────────────────────────────────────┘
                                 │ HTTPS  Authorization: Bearer <Firebase ID token>
                 ┌───────────────▼──────────────── Render ──────────────────────────┐
                 │ backend/  Node 22 + Hono API (TypeScript)                         │
                 │  • verifies Firebase token → user id                              │
                 │  • chat pipeline, LLM router, food resolver, cycle maths, memory  │
                 │  • Web Push sender, jobs (/jobs/*) protected by CRON secret       │
                 └──────┬──────────────┬───────────────┬───────────────┬────────────┘
                        │              │               │               │
                 Supabase Postgres  OpenRouter      USDA / OFF     Firebase Admin
                 + pgvector +       :free models    food APIs      (verify / delete user)
                 Storage (backups)
                        ▲
                 pg_cron + pg_net ──(every 5 min / nightly / weekly)──► backend /jobs/*
```

**Rules**
- The browser talks **only** to the backend. No database keys ever reach the browser.
- The backend is the only service that touches the database. It uses the Supabase service key and scopes every query by the user id taken from her verified Firebase token.
- Row Level Security stays **on** as a second safety net. With no policies for browser roles, a leaked anon key reads nothing.
- Code owns the facts (cycle maths, nutrition, dates). The LLM only writes the reply and extracts data, and Zod validates its output.

---

## 3. Folder structure

```
mcp/
├─ frontend/                    → Vercel (root directory: mcp/frontend)
│  ├─ src/
│  │  ├─ routes/                 Chat, Today, Cycle, Me, Insights, Onboarding, Sign-in, Me/* pages
│  │  ├─ components/             UI kit, calendar, chat bubbles, sheets, SVG charts, crisis card
│  │  ├─ lib/api.ts              typed client for the backend (types generated from backend OpenAPI)
│  │  ├─ lib/firebase.ts         sign-in, ID token, sign-out
│  │  ├─ lib/push.ts             subscribe/unsubscribe Web Push
│  │  ├─ i18n/ · theme/ · stores/
│  ├─ locales/en.json, ta.json   (moved from today's app, ~90% reused)
│  ├─ public/manifest.webmanifest, sw.js, icons
│  ├─ vercel.json                SPA rewrites + security headers (CSP, HSTS…)
│  └─ .env.example               VITE_API_URL, VITE_FIREBASE_* (public config only)
│
├─ backend/                     → Render (root directory: mcp/backend)
│  ├─ src/
│  │  ├─ server.ts               Hono app, CORS (Vercel origin only), error handling
│  │  ├─ auth/firebase.ts        verify ID token, delete user (firebase-admin)
│  │  ├─ routes/                 chat, foods, photo, logs, cycle, meds, labs, facts, insights,
│  │  │                          profile, push, export, account, med-action
│  │  ├─ jobs/                   reminders, retry-queue, daily-summary, cycle-check,
│  │  │                          weekly-recap, backup, model-health
│  │  ├─ core/                   ported pure logic: cycle, dates, language, food, score,
│  │  │                          safety, schemas, patterns, llm-router, prompts, messages
│  │  ├─ services/               context builder, apply-extracted, food resolver (db), facts,
│  │  │                          push (web-push), embeddings (gte-small)
│  │  └─ db/                     Supabase client + per-user query helpers
│  ├─ supabase/migrations, seed, config.toml   (database lives with the backend)
│  ├─ test/                      unit (ported 45 tests), API tests, PGlite DB test
│  ├─ openapi.json               generated; the frontend builds its types from it
│  ├─ render.yaml                Render blueprint (build/start commands, env var names)
│  └─ .env.example               all server secrets (names only)
│
├─ PLAN.md · README.md
```

---

## 4. Backend (Render)

| Item | Choice |
|---|---|
| Runtime | Node 22 LTS + TypeScript (strict), built with `tsc`, started with `node dist/server.js` |
| Web framework | **Hono**: small and fast, and uses web-standard Request/Response, so today's Deno Edge Function code ports almost line for line |
| Validation | Zod on every request body and every LLM output (existing schemas) |
| Auth | `firebase-admin` `verifyIdToken` on every request (except `/health` and `/jobs/*`) → `uid` |
| DB | `@supabase/supabase-js` with the service-role key (existing queries reused) |
| Embeddings | `@huggingface/transformers` running **gte-small** (384-dim, same as now) inside the backend. Downloaded at build time so a cold start doesn't re-download it |
| Push | `web-push` (VAPID): standard, well-tested Node library |
| Tests | Vitest: ported unit tests, API tests via `app.request()` with a mocked Firebase token, the PGlite DB test |

**API (all JSON, all need a Firebase token unless noted)**

| Area | Endpoints |
|---|---|
| Profile and onboarding | `GET/PATCH /me`, `POST /me/onboarding` |
| Chat | `GET /chat/messages`, `POST /chat/messages` (the existing pipeline), `POST /chat/messages/:id/confirm`, `POST /chat/logs/:id/undo` |
| Food | `POST /food/photo` (vision, nothing stored), `POST /food/logs`, `DELETE /food/logs/:id` |
| Today | `GET /today` (logs plus a **server-computed** balance score and cycle status), `POST /today/water`, `POST /quick-log` |
| Cycle | `GET /cycle` (periods, prediction range, insights), `POST /cycle/periods`, `PATCH/DELETE /cycle/periods/:id` |
| Medicines | CRUD `/meds`, `POST /meds/:id/taken` |
| Labs | CRUD `/labs` |
| Memory | `GET/PATCH/DELETE /facts` |
| Insights | `GET /insights`, `POST /insights/:id/dismiss` |
| Reports and data | `GET /report?from=&to=` (data for the printable report), `GET /export` (JSON download), `DELETE /account` (typed confirm: deletes data, backups, Firebase user) |
| Push | `POST/DELETE /push/subscription` |
| Medicine action | `POST /med-action` (no login: uses a short-lived signed token from the notification, for **Taken** / **Snooze**) |
| Jobs (cron secret) | `POST /jobs/reminders`, `/jobs/retry-queue`, `/jobs/cycle-check`, `/jobs/daily-summary`, `/jobs/weekly-recap`, `/jobs/backup`, `/jobs/model-health` |
| Health | `GET /health` |

**Scheduled jobs** (pg_cron in Supabase → backend, IST)

| Job | When |
|---|---|
| reminders | every 5 min (check-ins, medicine pushes) |
| retry-queue | every 5 min |
| cycle-check | 09:00 |
| daily-summary | 23:30 |
| weekly-recap | Sun 19:00 |
| backup | Sun 03:00 |
| model-health | Mon 03:00 |

Every job is idempotent, because Render can restart the service at any time.

---

## 5. Frontend (Vercel)

| Item | Choice |
|---|---|
| Build | **Vite + React 19 + TypeScript strict.** It's a static site; all server work lives in `backend/`, so Next.js isn't needed |
| Routing | React Router |
| Data | TanStack Query against `lib/api.ts`. Zustand for UI state. The cache stays in memory only |
| Login | Firebase web SDK (email/password + Google). The ID token is attached to every API call |
| i18n | i18next with the existing `en.json` / `ta.json` (414 keys) |
| Styling | CSS modules + CSS variables for light/dark (same tested palette), self-hosted Noto Sans + Noto Sans Tamil |
| Charts | Small hand-written SVG charts |
| PWA | Manifest + service worker: install to home screen, offline app shell, Web Push with **Taken / Snooze** actions |
| Layout | Phone: bottom tabs (Chat · Today · Cycle · Me). Desktop: sidebar, with Chat and Today side by side |
| Food photo | `<input type="file" accept="image/*" capture>`, downscaled to 1024 px in a canvas, sent once, never stored |
| Doctor report | Printable page, then the browser's "Save as PDF" |
| Tests | Vitest + Testing Library; Playwright smoke test against a mocked API |

---

## 6. Database changes (one migration)

- `app_users (id text primary key, created_at)`: one row per Firebase user, created on first sign-in.
- Every `user_id` changes from `uuid → auth.users` to `text → app_users(id) on delete cascade`, so "delete everything" is still one delete.
- RLS stays enabled on every table. Browser roles get **no** policies; only the service role (backend) reads and writes.
- `match_summaries` / `match_facts` take the user id as a parameter (service role only).
- New tables: `push_subscriptions` (endpoint and keys per device) and `reminder_log` (so each check-in or dose is pushed once).
- Remove `profile.expo_push_token`.
- The cron jobs call the backend URL. It's stored in Vault as `backend_url`, together with `cron_secret`.
- The 198-food seed, units and model list are unchanged.

---

## 7. Security and privacy

- Only Firebase's public web config is in the browser. The service-role key, OpenRouter, USDA, VAPID and Firebase Admin keys live only in Render env vars.
- CORS: the backend accepts requests only from the Vercel domain.
- Every handler gets `uid` from the verified token. Query helpers *require* `uid`, so no query can run unscoped. API tests check that user B can't read, change or delete user A's data through any endpoint.
- Rate limit is unchanged: 30 chat messages per 10 minutes.
- Security headers: Vercel (strict CSP: self, the backend URL and Firebase/Google sign-in only; HSTS; `no-referrer`) and the backend (Hono secure headers).
- Unchanged: PII scrubber, identifier-free LLM context, photos never stored, export and delete always available.

---

## 8. Free-tier facts and risks

| Fact / risk | Handling |
|---|---|
| Render free services **sleep after 15 min idle** and take **about 1 minute** to wake | The 5-minute reminder job keeps the backend awake, so chat replies don't hit cold starts. The frontend still shows a "waking up…" notice if a call takes long |
| Render gives **750 free instance hours per month** per workspace. Staying awake all month uses about 744 | Fits only if this is the **only** free service in your Render workspace. If hours run out, the backend pauses until next month. Fallback: send reminders every 10 min overnight |
| Render may restart the service at any time; disk is temporary | All state is in Supabase; jobs are idempotent; the embedding model is in the build image |
| Free instance RAM is small | gte-small quantised is about 35 MB. I'll measure memory in W0 before relying on it |
| Render free Postgres expires after 30 days | Not used; the data stays in Supabase |
| Firebase Spark plan | Email/password + Google sign-in are free. We don't use Cloud Functions, which would need the paid plan |
| iPhone push | Works only after "Add to Home Screen" (iOS 16.4+). Onboarding explains this |
| Vercel Hobby | Free for personal, non-commercial use |

---

## 9. Build phases and checks

**W0 — Foundation and deploy**
- Restructure into `frontend/` and `backend/`.
- Backend skeleton (Hono, Firebase token check, `/health`), ported core logic with all 45 tests green, the migration, and the PGlite DB test updated.
- Frontend skeleton (Vite, i18n, fonts, theme, PWA, sign-in with Firebase).
- Deploy both: Vercel and Render via `render.yaml`.
- Checks:
  - [ ] The Vercel site signs in with email and with Google, then calls the Render `/me` endpoint and shows her profile.
  - [ ] Language toggle changes every string, and Tamil renders correctly.
  - [ ] The DB test passes: browser roles read 0 rows; user B can't reach user A's data through the API.
  - [ ] Backend memory with gte-small loaded fits the free instance.

**W1 — Core**
- Onboarding, Chat (pipeline, confirm/undo chips, crisis card, queued replies), food photo, Today, Cycle, Settings.
- Web Push, reminders and med-action jobs.
- Checks:
  - [ ] "kaalaila 2 dosai saapten" logs 2 dosai at breakfast with a Tanglish reply.
  - [ ] "periods vandhuduchu" → confirm chip → period logged for today.
  - [ ] With 9 models disabled, the 10th answers. With all disabled, the message is saved, a bilingual notice shows, and the reply arrives later by push.
  - [ ] The prediction shows a range with confidence. Calories off → no kcal anywhere.
  - [ ] The morning check-in push arrives at her time and never in quiet hours. "Taken" on a medicine push writes the dose.

**W2 — Depth**
- Memory (facts, summaries, vector recall), "What Companion remembers", medicines, labs, quick log, delay and red-flag cards, insights with charts, model-health, language eval.
- Checks:
  - [ ] A fact from day 1 is followed up later.
  - [ ] A late period gets one gentle check-in with factors and no daily repeats.
  - [ ] Crisis phrases in all three languages show the support card.

**W3 — Reports and polish**
- Doctor report (print to PDF), export, delete everything, weekly backup, desktop layout, accessibility and Lighthouse pass.
- Checks:
  - [ ] Report has cycle history, symptoms, medicines and labs.
  - [ ] Delete everything leaves 0 rows, removes the Firebase user and push subscriptions, and signs out.
  - [ ] Lighthouse ≥ 90 for PWA, accessibility and best practices.

**W4 — Optional:** passkey unlock; voice input via the browser's speech recognition (free; Tamil quality varies).

I'll stop for review after each phase unless you say otherwise.

---

## 9b. W0 report (2026-10-08)

**Built**
- Repo split into `frontend/` and `backend/`. The old Android app (`legacy-app/`) and `docs/` were removed afterwards; the remaining Edge Function code is ported from git history (commit `acc1743`) in W1–W3.
- Backend: Hono API with Firebase token checks, user provisioning, `GET/PATCH /me`, `/health`, OpenAPI 3.1, CORS and secure headers, the Render blueprint, gte-small embedding service and model prefetch.
- Pure core logic ported from the Edge Functions, with all 45 tests green on Node.
- Database: migrations changed to Firebase `text` user ids with an `app_users` cascade root, backend-only access, and `push_subscriptions` + `reminder_log`. The 7 cron jobs call the backend. Nothing had been deployed, so the base migrations were edited directly rather than adding an ALTER migration.
- Frontend: Vite + React 19 PWA with Firebase sign-in (email/password + Google + reset), typed API client generated from the backend's OpenAPI, and a "waking up" notice. Also i18n (426 keys en/ta), light/dark themes, Latin + Tamil font subsets, service worker, manifest and icons, and Vercel security headers.

**Checks**

| Check | Status |
|---|---|
| Vercel site signs in with email/Google and shows the profile from Render `/me` | ⏳ Needs your Firebase, Render and Vercel accounts. Covered locally by API tests with a mocked token, a client test confirming the Firebase token is sent, and a test that the built server answers `/health` and returns 401 on `/me` without a token |
| Language toggle changes every string; Tamil renders | ✅ A render test switches English → Tamil with no English strings left. Checked visually in the browser at desktop and phone width (Tamil renders correctly). `check:locales` blocks hard-coded text |
| Browser roles read 0 rows; user B can't reach user A's data | ✅ PGlite DB test covers every table (anon and authenticated denied everywhere, user-scoped queries, cascade delete). API tests cover token checks, CORS, PATCH scoping and rejected fields |
| Backend memory with gte-small fits the free instance | ⏳ Hugging Face is blocked by the office proxy (403). Render's build runs `prefetch-model`, which prints the memory figures in the build log |

**Numbers:** backend 54 tests, frontend 31 tests, DB test all passing. Offline cache 689 KB.

**Open items:** `llm_models` seed still unverified (openrouter.ai is blocked here), and the Tamil review in `frontend/TRANSLATION_REVIEW.md`.

## 10. What you'll need (all free)

| Service | What to set up |
|---|---|
| Firebase | Create a project, enable **Email/Password** and **Google** sign-in, copy the web config, download a **service-account key (JSON)** |
| Supabase | Create a project (Mumbai). You'll use the URL + service-role key (backend only) |
| Render | Account, new **Web Service** from the GitHub repo, root `mcp/backend` (or "New → Blueprint" with `render.yaml`), then paste the secrets |
| Vercel | Account, import the GitHub repo, root `mcp/frontend`, add `VITE_API_URL` (the Render URL) + Firebase web config |
| OpenRouter, USDA | API keys, as before |

---

Reply **"approved"** (or tell me what to change) and I'll start W0.


## W1 + W2 report (2026-10-08)

**Built**
- **Backend:**
  - The Supabase layer was replaced by a MongoDB store with user-scoped collections (`user_id` is added to every query).
  - The chat pipeline was ported: one LLM call with the 10-model OpenRouter fallback, circuit breaker, daily budget, Zod plus language and persona checks, and queued replies when the AI is down.
  - Also ported: the food resolver (198 dishes and USDA, Open Food Facts, AI estimate), cycle maths, memory (facts and summaries, with cosine similarity computed in code), Web Push with Taken / Snooze tokens, and the jobs (reminders, retry queue, cycle check, daily summary, model health) behind `/jobs/tick`.
  - 31 typed endpoints, documented in OpenAPI.
- **Frontend:** Onboarding, Chat (confirm and undo chips, crisis card, photo logging), Today, Cycle, Me, Settings (including notifications), What Companion remembers, Medicines, Labs and Insights (SVG charts). 534 strings in English and Tamil.

**Checks**
- ✅ Backend: 96 tests.
  - Covered: "kaalaila 2 dosai saapten" (2 dosai at breakfast, 160 g, Tanglish model caps), the "periods vandhuduchu" chip confirm and undo, relative days, queued reply then retry then push, the language check, idempotent resend, rate limit, and crisis in English, Tamil and Tanglish.
  - Also covered: PII is never sent to the LLM, user isolation across every endpoint, calories hidden, reminders (once only, quiet hours, cap, Tamil text), medicine token Taken / Snooze, the delay check-in at 1, 7 and 14 days only, red flags, auto-close, and daily summary with fact retirement.
- ⏭ 5 store tests run only against a real MongoDB (`MONGODB_TEST_URI`). The MongoDB binary download is blocked on the office network.
- ✅ Frontend: 78 tests, types, lint, 534 locale keys checked, production build (offline cache 805 KB).
- ✅ Browser walkthrough of the onboarding flow on the dev servers with the test login. The rest is covered by tests.
- ⏳ **Real push notifications:** the built-in browser pane blocks service workers and notification permission. To test, open `http://localhost:5173` in normal Chrome, then Settings → Notifications → Turn on → Send a test. The local push keys are in the git-ignored env files.
- ⏳ **Live AI replies:** need `OPENROUTER_API_KEY` and a network that can reach openrouter.ai (it's blocked here). Until then messages are queued, and the backend retries them every 5 minutes.

**Known gaps**
- Doctor report, export, delete everything and app lock are still W3.
- The privacy text in onboarding mentions export and delete, which arrive in W3.
- Weekly recap message (W3).
