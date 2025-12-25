# medend-backend-standard (Next.js + Prisma + Postgres)

A clean, standard Next.js App Router backend with:
- Auth (register/login/logout) using DB-backed sessions (httpOnly cookie)
- Rate limiting (simple in-memory)
- Chat API with modes: **medical**, **therapy**, **recipe**
- Optional OpenAI integration (if `OPENAI_API_KEY` is set); otherwise safe mock replies
- Prisma models for Users/Sessions/Chat history

## Quick start (local)
1) Install deps
```bash
npm i
```

2) Create `.env` from `.env.example` and set DB URLs

3) Migrate + seed
```bash
npx prisma migrate dev
npm run db:seed
```

4) Run
```bash
npm run dev
```

## Endpoints
- `POST /api/auth/register` { email, password, name? }
- `POST /api/auth/login` { email, password }
- `POST /api/auth/logout`
- `GET  /api/me`
- `POST /api/chat` { message, mode: "medical"|"therapy"|"recipe" }

All responses are standardized:
- success: `{ ok: true, data: ... }`
- error: `{ ok: false, error: { code, message, extra? } }`

## Production notes (Vercel + Neon)
- Set env:
  - `DATABASE_URL` = pooled URL with `pgbouncer=true&connection_limit=1`
  - `DIRECT_URL`   = direct URL (for migrations)
- Keep Prisma migrations committed.


## Legacy Questionnaire (Updated)

- UI route: `/questionnaire` (embeds `/legacy/questionnaire.html`)
- Legacy API contract:
  - GET/POST `/api/questionnaire_handler.php`
  - GET `/api/medical_record.php?lang=<code>`
- Legacy medical record page: `/legacy/medical_record.html`

After login, open `/dashboard`.

## V1.2 Recipes (cache + saved)

- UI: `/recipes`
- API:
  - POST `/api/recipes/generate` → `{ meta: { cache: "hit"|"miss", expiresAt }, output }`
  - GET `/api/recipes/saved`
  - POST `/api/recipes/save`
- Cache TTL controlled by `RECIPE_CACHE_TTL_SECONDS`.

**Done condition:** generate twice with same ingredients → second call returns `cache: hit`. Then click **Save** → shows in Saved list.

## V1.3 Therapy MVP

- UI: `/therapy`
- DB: `TherapySession`, `TherapyMessage`
- API:
  - POST `/api/therapy/send` (creates session automatically if `sessionId` not provided)
  - GET `/api/therapy/sessions`
  - GET `/api/therapy/history?sessionId=...`

Includes a lightweight crisis keyword guard (returns a safety message instead of calling the model).

## V2 Personalization (Journal snapshot + patch)

The app maintains a central `Journal` JSON (per user). After **medical** chat (and therapy, when using `/api/therapy/send`), it can:

1) build snapshot (`buildProfileSnapshot(userId)`)
2) ask AI to extract a conservative patch
3) apply it (`applyProfilePatch(userId, patch, source)`), saving an audit row in `ProfilePatchAudit`

Toggle with `PROFILE_EXTRACTOR_ENABLED=0` to disable.

You can inspect the current journal at `/journal`.

## V2.1 External Python AI service switch

Set:

- `AI_PROVIDER=python`
- `PY_AI_URL=https://...` (your FastAPI service base URL)
- `PY_AI_SECRET=...`

Endpoints expected on the Python service:

- `POST /ai/extract-profile`
- `POST /ai/generate-recipes`
- `POST /ai/therapy-response`

Requests include HMAC signature headers: `X-AI-Timestamp`, `X-AI-Nonce`, `X-AI-Signature`.

## Notes on rate limits

Current rate limiter is an in-memory sliding window (good for MVP and local dev).  
If you want strict limits on Vercel production, swap it for Upstash/Redis or DB-backed counters.
