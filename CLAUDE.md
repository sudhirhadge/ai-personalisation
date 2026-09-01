# CLAUDE.md

Guidance for Claude Code (and similar AI tools) working in this repo.

## What this repo is

Two independent products live side by side here:

1. **AI Personalization** (the live product) — a user uploads a photo, picks a generation mode, and gets back an AI-personalized image (optionally composited onto a product wrapper template). This is where active development happens.
2. **Legacy CRUD demo** (`items`, `users`, `Product` catalog, Redux `items`/`users` slices, `AppContent.jsx` and its components) — an older scaffold, superseded by the product above. **Leave this untouched** unless explicitly asked to work on it; its routes (`routes/items.js`, `routes/users.js`, `routes/products.js`) aren't even mounted in `server/app.js`.

Two independent npm packages, no root workspace: `client/` (Vite + React 18 + TypeScript) and `server/` (Express + MongoDB + BullMQ, CommonJS). A minimal root `package.json` exists only to host git hooks (husky/lint-staged) — it is not a workspace root.

## Architecture

**Server** (`server/`) — routes → controllers → services → repositories:
- `routes/{sessions,storage,ai,wrapperTemplates}.js` mount onto `app.js` at `/api/v1/...`.
- `controllers/` handle HTTP concerns only; business logic lives in `services/`.
- `services/aiService.js` calls Hugging Face (text-to-image, image-to-image) and `services/blackForestLabsService.js` calls Black Forest Labs (multi-reference compositing).
- `services/imageCompositeService.js` holds `WRAPPER_OVERLAY_REGIONS`, the per-SKU registry of wrapper templates + compositing coordinates.
- `queues/aiQueue.js` — 4 BullMQ queue/worker pairs (one per generation mode), backed by Upstash Redis.
- `repositories/sessionRepository.js` — the only place that talks to the `Session` Mongoose model directly.

**Client** (`client/src/features/AI_Personalization/`) — feature-based structure:
- `types/` — shared TS types (mirror the server's wire shapes).
- `api/` — `httpClient.ts` (axios + interceptors) + one file per resource.
- `config/generationModes.ts` — single source of truth mapping each of the 4 generation modes to its endpoint, prompt requirement, and wrapper-template requirement. Prefer extending this table over adding a new function/branch when a mode changes.
- `hooks/` — TanStack Query hooks wrapping `api/`. All server state (session, job status, wrapper templates) lives in the Query cache — no Redux, no component-level mirrors of server data.
- `context/PersonalizationWizardContext.tsx` — the *only* client-only state (wizard step, selected mode).
- `components/`, `pages/`, `utils/` — as named.

## Two separate auth systems — don't conflate them

- **Session JWT** (`services/tokenService.js`, `middleware/authPersonlization.js`) — issued at session creation, decoded payload is `{ sessionId, type }` (no `email`). This is what the AI Personalization flow uses everywhere.
- **User-login JWT** (`middleware/auth.js`, `routes/users.js`) — separate access+refresh token pair for the legacy CRUD demo. Unrelated system; don't mix the two.

## Known gotchas worth remembering

- **One AI job per session.** `Session` (model) has a single `aiJobId`/`processedImageUrl` pair, not an array — a session can't run two generation modes in parallel or compare results. The UI's answer is "start a new session" to try a different mode.
- **`Session.personalizationLink` (the Mongoose virtual) is unreliable after creation.** It's built from a legacy DB-only UUID field, not the real signed JWT. Only the `POST /sessions` response's `personalizationLink` is correct. Everywhere else, rebuild the link client-side from the held JWT via `utils/personalizationLink.ts`'s `buildPersonalizeNowUrl`.
- **`config.bypassAi`** (`server/config/index.js`, driven by `BYPASS_AI` in `.env`) skips real HF/BFL calls across all 4 generation modes — a placeholder image for text-to-image, the echoed source photo for image-to-image, and the free deterministic sharp composite for both wrapper-composite modes. Useful for local dev/testing without spending API credits; must default to `false`.
- **Free-tier infra expires from inactivity.** Both Upstash Redis and MongoDB Atlas free tiers have gone dead after weeks/months of no traffic (symptom: DNS `ENOTFOUND` on the Upstash hostname, or Mongo connection failures). Check the respective consoles and recreate before assuming a code bug.
- **BullMQ/ioredis connects eagerly regardless of `lazyConnect`.** `app.js` unconditionally requires the AI routes → the queue module → constructs BullMQ `Queue`/`Worker` pairs, which force a real Redis connection + health check at require-time no matter what ioredis options are set. Server tests mock the whole module (`server/queues/__mocks__/aiQueue.js`) rather than fighting this.

## Commands

```bash
# Dev servers (run each in its own terminal)
cd server && npm run dev      # nodemon, port 5000
cd client && npm run dev      # Vite, port 5173

# Tests
cd client && npm test         # Vitest
cd server && npm test         # Jest + Supertest + mongodb-memory-server (in-memory, no real DB needed)

# Lint / format
npm run lint:client           # from repo root
npm run lint:server           # from repo root
npm run format                # Prettier, repo-wide (writes)
npm run format:check          # Prettier, repo-wide (check only)
```

A pre-commit hook (husky + lint-staged) auto-runs eslint --fix + prettier --write on staged files in whichever of `client/`/`server/` they belong to.

## Conventions

- **TypeScript for new frontend code**; legacy `.jsx` stays as-is (`allowJs: true` lets them coexist).
- **Commits are phase-wise, one concern per commit**, `type: short description` (`feat:`, `fix:`, `chore:`), e.g. `feat: add public wrapper-templates endpoint + static asset serving`. Prefer several small, buildable-at-each-step commits over one large one — this repo's history is meant to be readable/bisectable later, not just a snapshot of the final diff.
- Before running anything that could discard uncommitted work, check `git status` first.

## Environment setup

Copy `server/.env.example` → `server/.env` and `client/.env.example` → `client/.env`, then fill in real values (Mongo URI, JWT secrets, HF/BFL API keys, Upstash Redis credentials). Never commit the real `.env` files — both are gitignored.
