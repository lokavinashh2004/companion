# Companion: a private PCOS tracker and bilingual friend (website)

Companion is a website that installs like an app. It's a warm companion that chats in English, Tamil script or Tanglish, logs food, cycle, symptoms, mood and medicines, remembers your life like a friend, and explains possible reasons when a period is late. It runs on free tiers.

**The model talks; code owns the facts.** Dates, cycle maths and nutrition are computed in TypeScript on the backend. The LLM only writes replies and extracts data, and every LLM output is validated with Zod. Companion is not a doctor.

```
frontend/   React + Vite PWA           → Vercel   (talks only to the backend)
backend/    Node 22 + Hono API         → Render   (Firebase token check, chat pipeline, jobs)
            MongoDB                    → Atlas    (free M0 cluster)
            AI replies                 → OpenRouter :free models (up to 10, with automatic fallback)
```

- **Logins:** Firebase Authentication (email/password + Google).
- **No direct database access from the browser.** The backend checks the Firebase ID token on every request. Every query goes through a *user-scoped* store that adds `user_id` automatically, so one user can't read another's data.
- **AI fallback:** each chat message makes **one** LLM call. The router tries up to 10 free OpenRouter models in priority order, with a per-model timeout and a circuit breaker for failing models. It respects a daily request budget (50 by default) and checks each reply's JSON, language and persona before accepting it. If every model fails, the message is saved and queued, and the reply arrives later with a push notification.
- **Scheduling:** an external scheduler (cron-job.org, free) calls `POST /jobs/tick` every 5 minutes. That one call sends due reminders, retries queued replies, runs the cycle check once a day (after 09:00 IST), writes daily summaries (after 23:30 IST), and runs the model health check on Mondays.

## Features

| | |
|---|---|
| Chat | Companion chat in English, Tamil script or Tanglish. Food, symptoms, mood, sleep, water, exercise and medicines are pulled from messages and logged automatically, with an **Undo** chip. Period starts and ends need a **confirm** chip first. Queued replies when the AI is down. Crisis support card with Tele-MANAS 14416 |
| Food | Tamil food list (198 dishes, 1,884 spellings in English, Tanglish and Tamil script), then USDA, then Open Food Facts, then an AI ingredient estimate. Photo logging with an edit-before-save step (the photo is not stored). Balance score 0–10. Calories are hidden unless she turns them on |
| Cycle | Calendar, history, predicted **range** with confidence (never a single date, never ovulation). Late-period check-in with possible factors at 1, 7 and 14 days only. Red-flag cards. Auto-close after 10 days |
| Today | Cycle card, balance score, meals, water +250, mood, symptoms, medicine checklist, quick log, weekly weight (optional) |
| Memory | Remembered facts (deduplicated, at most 60, editable on "What Companion remembers"), nightly summaries with gte-small embeddings, related memories in each chat |
| Reminders | Web Push: morning and evening check-ins, water nudges (optional), medicine reminders with **Taken / Snooze** buttons. Quiet hours and at most 4 a day (medicine reminders don't count) |
| Insights | Weekly numbers, cycle lengths, balance and mood trends, smoothed weight trend (only if she turns it on), patterns like "you might notice…" once there are 3 or more cycles |

---

## Local development

You need Node 22+, a Firebase project and a MongoDB connection string (see Deploy, steps 1 and 2).

```bash
npm run install:all
```

Copy `backend/.env.example` to `backend/.env` and fill in at least `FIREBASE_PROJECT_ID` and `MONGODB_URI`. Copy `frontend/.env.example` to `frontend/.env.local` and fill in the `VITE_FIREBASE_*` values. Both files are git-ignored.

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Open `http://localhost:5173` and create an account. Without `OPENROUTER_API_KEY`, chat messages are saved and queued (the "reply coming soon" notice), and everything else works.

Run every check (tests use an in-memory store, so they need no accounts):

```bash
npm run verify
```

To run the MongoDB versions of the store tests against a real database (for example your Atlas cluster), set `MONGODB_TEST_URI`. They use a throwaway database.

After you change a backend route, regenerate the frontend's API types:

```bash
npm run api:types
```

Turn on the pre-commit secret scan (once per clone):

```bash
git config core.hooksPath backend/scripts/git-hooks
```

The Tamil strings to review are in `frontend/TRANSLATION_REVIEW.md`.

---

## Deploy (all free)

### 1. Firebase (logins)
1. In the [Firebase console](https://console.firebase.google.com), click **Add project**. Under **Authentication → Sign-in method**, enable **Email/Password** and **Google**.
2. Under **Project settings → Your apps**, add a **Web app** and copy `apiKey`, `authDomain`, `projectId` and `appId` (for the frontend).
3. Under **Project settings → Service accounts**, click **Generate new private key** to download the JSON (backend only, never commit it).

### 2. MongoDB Atlas (database)
1. On [cloud.mongodb.com](https://cloud.mongodb.com), create a free **M0** cluster (region: Mumbai).
2. Under **Database Access**, add a user with a strong password.
3. Under **Network Access**, allow `0.0.0.0/0`. Render's free plan has no fixed outbound IP; access is protected by the user and password.
4. Under **Connect → Drivers**, copy the connection string. That's `MONGODB_URI`.

Collections, indexes and the food list are created automatically the first time the backend starts.

### 3. OpenRouter (AI) and USDA (food data)
- Create a key at [openrouter.ai](https://openrouter.ai). In **Settings → Privacy**, review the free providers' logging policies.
- Request a free USDA FoodData Central API key.
- `backend/src/store/seed/llm-models.json` is a starter list of 10 free models. openrouter.ai was blocked on the build machine, so the list is **not verified**. From a network that can reach OpenRouter, refresh it and test language quality:

```bash
npm --prefix backend run models:seed
```

```bash
npm --prefix backend run models:eval -- --apply
```

The eval uses 15 requests per model. Use `MODELS=id1,id2` to test a few at a time, read `backend/eval/*.md`, then commit and redeploy.

### 4. Render (backend)
1. Choose **New → Blueprint** and pick this repo; Render reads `render.yaml` at the repo root (it builds the `backend/` folder).
2. Fill in the secrets:

| Variable | Value |
|---|---|
| `ALLOWED_ORIGINS` | Your Vercel URL, e.g. `https://companion.vercel.app` |
| `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT` | From Firebase (paste the JSON on one line) |
| `MONGODB_URI` | From Atlas |
| `OPENROUTER_API_KEY`, `USDA_API_KEY` | API keys |
| `CRON_SECRET`, `MED_ACTION_SECRET` | Two different random strings: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`; the subject is `mailto:you@example.com` |

3. Check `https://<service>.onrender.com/health`. It should show `{"ok":true,…,"store":"mongo"}`. The build log also prints the memory used by the gte-small embedding model.

### 5. Scheduler (cron-job.org, free)
Create a job:
- URL: `https://<service>.onrender.com/jobs/tick`
- Method: `POST`
- Schedule: every 5 minutes
- Header: `x-cron-secret: <CRON_SECRET>`

This also keeps the free Render service awake, so chat doesn't hit a one-minute cold start. Render's 750 free hours a month cover one always-on service, so keep it as the only free service in that Render workspace.

### 6. Vercel (frontend)
1. Import the repo and set the **Root Directory** to `frontend`.
2. Add the environment variables `VITE_API_URL` (your Render URL), `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` and `VITE_VAPID_PUBLIC_KEY`.
3. In Firebase, under **Authentication → Settings → Authorized domains**, add your Vercel domain.
4. On your phone, open the site and choose **Add to Home Screen**. On iPhone, notifications only work from the installed icon (iOS 16.4+).

---

## Privacy and safety

- The browser stores only Firebase's own login session and two display preferences (language, theme). No health data is stored in the browser, and the data cache is in memory only.
- Secrets (MongoDB, Firebase Admin, OpenRouter, VAPID) exist only in Render's environment. CORS allows only your Vercel origin.
- Before any LLM call, phone numbers and emails are scrubbed. The context never contains her name.
- Food photos are downscaled in the browser, sent once, and never stored.
- Medicine notifications carry a short-lived signed token, so **Taken / Snooze** works without logging in. It needs internet.
- The free MongoDB tier has no backups. Export and Delete everything come in W3.

The app supports you. It does not replace a doctor.
