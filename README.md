# The Box

A tiny creative game: you start with an **AI-generated photo of a box**. Type a prompt like *“add a hat”*, and the app paints a **new AI photo** of that same box with your additions. Every turn is **logged to Supabase** so you can browse past games.

This repo revives the original [Froggo23/thebox](https://github.com/Froggo23/thebox) experiment (Spring Boot + Gemini rewriting SVG). The product is no longer HTML/SVG art — it’s **real AI photo generation** (Pollinations by default, optional OpenAI) plus **Postgres/Storage** game logging via Supabase, wrapped in a polished React UI.

Architecture follows [bulletproof-react](https://github.com/alan2207/bulletproof-react) *principles* at small-app scale:

- feature folders (`src/features/box`)
- shared pure helpers (`src/shared`)
- server-side API so secrets never hit the client
- env-based configuration

## Stack

- **React + TypeScript + Vite** — UI
- **Express** — `/api/generate`, `/api/games`
- **Pollinations** — AI photos (default free CDN; optional paid gen API)
- **OpenAI Images** — optional (`IMAGE_PROVIDER=openai`)
- **Supabase** — `game_sessions` / `game_turns` + `box-images` storage bucket
- **Vitest + Supertest** — prompt validation + handler tests (mocked network)

## Quick start (local host)

Requires **Docker** for Supabase local stack.

```bash
# 1. Install
npm install

# 2. Start Supabase (DB + Storage + Studio + local MCP)
npm run supabase:start
# Studio:  http://127.0.0.1:54323
# API:     http://127.0.0.1:54321
# MCP:     http://127.0.0.1:54321/mcp

# 3. Configure secrets
cp .env.example .env
# Default images use free Pollinations (no key needed).
# Optional: POLLINATIONS_API_KEY + POLLINATIONS_MODE=gen if you have pollen balance.
# For local Supabase, copy keys from:
npx supabase status -o env
# into SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 4. Dev (API :3001, Vite :5173, /api proxied)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Past games appear in the right-hand **Past games** panel (data from Supabase).

### Production-ish local run

```bash
npm run build
npm start
```

Serves the built UI and API from Express (`PORT`, default `3001`) while still talking to whatever Supabase you configured in `.env`.

## Supabase: what gets hosted

| Resource | Purpose |
|----------|---------|
| `game_sessions` | One “play” / reset cycle |
| `game_turns` | Each image generation (default or addition) |
| Storage bucket `box-images` | Public PNG/JPEG of every turn |
| Studio | Browse tables + files at :54323 (local) |

Migrations live in `supabase/migrations/`.

### Cloud project (optional)

1. Create a project at [supabase.com](https://supabase.com).
2. `npx supabase link --project-ref <ref>`
3. `npx supabase db push`
4. Put cloud `SUPABASE_URL` + **service role** key in `.env` (server only).
5. Deploy the Express app (Railway, Fly, Render, etc.) or keep running `npm start` with cloud env.

Remote **Supabase MCP** (`https://mcp.supabase.com/mcp`) needs OAuth in the Grok `/mcps` UI. This repo is already set up against **local** MCP at `http://127.0.0.1:54321/mcp` while `supabase start` is running.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `IMAGE_PROVIDER` | no | `pollinations` (default) or `openai` |
| `POLLINATIONS_MODE` | no | `free` (default) or `gen` (needs key + pollen) |
| `POLLINATIONS_API_KEY` | only for `gen` | Pollinations key — **server only** |
| `OPENAI_API_KEY` | only if openai | OpenAI key — **server only** |
| `PORT` | no | API port, default `3001` |
| `SUPABASE_URL` | for logging | e.g. `http://127.0.0.1:54321` |
| `SUPABASE_ANON_KEY` | optional | Publishable / anon JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | for logging | Service role JWT (server writes) |

See `.env.example`. `.env` is gitignored.

### Security note

If an API key was ever pasted into chat, issues, or commits, **rotate it**. Never put the Supabase **service role** key in client code or Vite `VITE_*` vars.

If generation fails with `401 Incorrect API key`, create a fresh OpenAI key and update `.env`.

## How it works

1. First load → `POST /api/generate` `mode: "default"` → box photo + new `game_sessions` row + storage upload.
2. User prompt → `mode: "addition"` → new photo + another `game_turns` row on the same session.
3. `GET /api/games` lists past sessions for the UI gallery.
4. Image keys stay server-side. Free Pollinations uses `image.pollinations.ai`; paid gen uses `gen.pollinations.ai` and falls back to free if balance is 0.

Legacy Spring/Gemini/SVG sources are archived under [`legacy/`](./legacy/).

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Client + API with hot reload |
| `npm test` | Unit/integration tests |
| `npm run build` | Typecheck + Vite production build |
| `npm start` | Serve `dist` + API |
| `npm run supabase:start` | Local Supabase stack |
| `npm run supabase:stop` | Stop local stack |
| `npm run supabase:status` | Print URLs + keys |
| `npm run supabase:reset` | Reset DB + re-apply migrations |

## Project layout

```
src/
  app/                 # shell UI + global styles
  features/box/        # game feature (api, components, hooks)
  shared/              # pure prompt helpers + types
server/
  index.ts             # Express entry
  routes/generate.ts   # image generation + logging hook
  routes/games.ts      # list/get past games
  lib/openaiImages.ts
  lib/supabase.ts
  lib/gameLog.ts       # sessions, turns, storage upload
supabase/
  migrations/          # schema + grants
tests/
legacy/
```

## License

Personal project — see repository settings / add a license if you open-source further.
