# AmarElaka (আমার এলাকা)

A mobile-first, bilingual (Bangla / English) civic-tech MVP for Bangladesh. Residents report neighbourhood problems (waterlogging, potholes, broken streetlights, garbage, blocked roads), neighbours confirm whether they still exist, and anyone can browse a live map or share an area's status page.

> **AmarElaka is not an emergency service.** Reports are community-submitted and are **not** official government records. The app never claims that an agency has acted; the strongest state is **"Community-reported resolved"**.

- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · MongoDB Atlas (official driver 6.x) · Leaflet + OpenStreetMap-compatible tiles · Zod · sharp
- **Docs:** [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [Security & access control](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) · [External services & costs](docs/SERVICES_AND_COSTS.md) · [Manual test checklist](docs/MANUAL_TEST_CHECKLIST.md) · [Launch checklist & known limitations](docs/LAUNCH_CHECKLIST.md)

---

## Features

| Area | What's there |
|---|---|
| Explore | Leaflet map with category markers, list view (keyboard-friendly alternative), category + status filters, area search, "in view now" summary, freshness labels, paginated list, "use my location", shareable map URL. Mobile: map/list switch + bottom sheet + bottom nav with a central Report button. Desktop: sidebar + map. |
| Polls | Bilingual public-opinion polls on government, society and local issues; one vote per IP address and browser profile per poll, results after voting or close, optional deadlines and source links. Moderators and admins publish and close polls. |
| Report | Category cards, title/description with limits, map pin (tap/drag) or manual coordinates, preview of the **public** ~150 m cell, optional photo (client-side compression, server-side validation + EXIF/GPS stripping), privacy warnings, duplicate detection with "submit anyway", success + next steps. |
| Issue detail | Approximate location (circle, never a pin), status + freshness, created/last-confirmed times, public update history, the three actions: **confirm present / appears fixed / flag**, share. |
| Areas | Stable `/areas/<slug>` pages with counts, unresolved, community-reported resolutions, category breakdown, last-updated, WhatsApp/Facebook/native share, dynamic Open Graph share card. |
| Moderation | Queues (pending, flagged, possible duplicates, under review, photos), approve / hide / reject / merge / archive / restore / review / dismiss flags, photo approval, private exact location (moderators only), poll publishing/closing, audit log. |
| Accounts | Email + password, settings (display name, language), my reports (with visibility state), JSON data export, account deletion (optionally removing reports). |
| Info | About, community guidelines, privacy notice, emergency-service disclaimer — in Bangla and English (marked as drafts pending legal review). |

---

## Local setup

### Prerequisites
- Node.js **20.9+** (tested with 20.20)
- A **MongoDB Atlas** cluster (the free M0 tier is enough for development — see [costs](docs/SERVICES_AND_COSTS.md))

### 1. Install
```bash
npm install
```

### 2. Create a MongoDB Atlas database
1. Sign in at <https://cloud.mongodb.com> → create a project → **Create cluster** (M0 Free is fine for development; choose a region close to Bangladesh, e.g. Mumbai `ap-south-1` or Singapore).
2. **Database Access → Add New Database User**
   - Authentication: password (generate a strong one).
   - Privileges: **Specific privileges → `readWrite` on database `amarelaka_dev`** (use a separate user with `readWrite` on `amarelaka` for production). Do **not** use `atlasAdmin`.
3. **Network Access → Add IP Address**: add your current IP for development. For hosting, see [Deployment](docs/DEPLOYMENT.md#atlas-network-access).
4. **Connect → Drivers → Node.js** and copy the `mongodb+srv://…` connection string.

### 3. Configure environment
```bash
cp .env.example .env.local
```
Fill in `.env.local` (placeholder names are documented in `.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string with the app user's password |
| `MONGODB_DB` | yes | e.g. `amarelaka_dev` (dev) / `amarelaka` (prod) |
| `APP_URL` | yes | `http://localhost:3000` locally; your public URL in production (used for share links / OG tags and origin checks) |
| `IP_HASH_SECRET` | yes in prod | 32+ random bytes: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TRUST_PROXY` | prod | `true` only behind a proxy that sets `X-Forwarded-For` (Vercel/Render/Fly) |
| `NEXT_PUBLIC_MAP_TILE_URL` / `_ATTRIBUTION` / `_MAX_ZOOM` | no | Tile provider (defaults to public OSM tiles — dev only) |
| `REPORTS_REQUIRE_APPROVAL` | no | `true` = new reports hidden until approved (default `false`) |
| `PHOTOS_REQUIRE_APPROVAL` | no | `true` = photos hidden until approved (default `true`, recommended) |
| `ALLOW_DEV_SEED` | dev only | must be `true` for the dev seed script to run |

### 4. Migrate and seed
```bash
npm run db:migrate        # creates collections, $jsonSchema validators and indexes (idempotent)
npm run db:seed:areas     # reference neighbourhood areas (safe for production; approximate boundaries)
# development only — fictional reports + dev accounts:
ALLOW_DEV_SEED=true npm run db:seed:dev          # (PowerShell: $env:ALLOW_DEV_SEED="true"; npm run db:seed:dev)
```
The dev seed prints the dev logins (`moderator@example.test`, `resident1@example.test` … with a dev-only password). Remove seed data with `npm run db:seed:dev -- --reset --only-reset`.

The poll collections and their unique one-vote-per-IP index are installed by `npm run db:migrate` (migrations `002_polls` and `003_poll_device_voters`). Production voting requires `TRUST_PROXY=true` behind a trusted proxy that supplies the real client address, plus a stable `IP_HASH_SECRET`; voting fails closed if the production request has no verified client IP.

### 5. Run
```bash
npm run dev        # http://localhost:3000
```

### 6. Make someone a moderator
There is intentionally no UI/API for role changes:
```bash
npm run user:role -- person@example.com moderator   # or admin / resident
```
The change is written to the audit log.

---

## Map configuration

Any OpenStreetMap-compatible **raster XYZ** tile URL works:

```env
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_ATTRIBUTION=&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
NEXT_PUBLIC_MAP_MAX_ZOOM=19
```

- The **public OSM tile server is for light/dev use only** and has a [usage policy](https://operations.osmfoundation.org/policies/tiles/) (no heavy traffic, attribution required, valid referer). Before launch, switch to a provider plan (e.g. MapTiler, Stadia Maps, Thunderforest, Jawg — all have limited free tiers) or self-host tiles. Put the provider's key in the URL only if the provider allows public, domain-restricted keys.
- `NEXT_PUBLIC_*` values are compiled into the client bundle — rebuild after changing them.
- If tiles fail, markers and the list view still work.

---

## Testing

```bash
npm test            # unit + integration tests (Vitest)
npm run typecheck
npm run lint
npm run check       # all three
```

Integration tests start an **in-process MongoDB** via `mongodb-memory-server` — no Atlas account, Docker or network database is needed. The first run downloads a `mongod` binary (~100 MB) into the package cache.

Covered: report validation, personal-info detection, public-coordinate privacy, freshness, the status machine (verify / resolve / reopen), duplicate votes (API **and** DB unique index), self-confirmation block, guest limits, rate limits + `Retry-After`, moderation permissions (anonymous / resident / moderator), moderation transitions and audit events, merge, photo EXIF/GPS stripping and type sniffing, photo approval gating, account isolation (a resident cannot modify another's profile or self-promote), data export, account deletion/anonymisation, CSRF origin checks, and consistent error bodies.

For the manual mobile/desktop checklist see [docs/MANUAL_TEST_CHECKLIST.md](docs/MANUAL_TEST_CHECKLIST.md).

---

## Project structure

```
migrations/            versioned schema migrations (validators + indexes), runner
scripts/               migrate, seed-areas (prod-safe), seed-dev (dev-only, guarded), set-role
src/
  app/                 Next.js routes (pages + /api route handlers)
  components/          UI: ui/ (primitives), layout/, map/ (lazy Leaflet), explore/, report/, issues/, moderation/, share/, account/
  config/app-config.ts categories, thresholds, freshness windows, rate limits (single source of truth)
  i18n/                en.ts, bn.ts dictionaries + server/client helpers
  lib/                 pure, client-safe logic: validation (Zod), status machine, freshness, geo/privacy, moderation rules
  server/              server-only: db, auth (scrypt + sessions), http helpers, rate limiter, services/, DTO mappers
tests/                 unit/ and integration/ (Vitest + mongodb-memory-server)
docs/                  architecture, database, security, deployment, costs, checklists
```

Configurable product rules (categories, thresholds such as "2 independent confirmations within 48 h", freshness windows, rate limits, photo limits) live in [`src/config/app-config.ts`](src/config/app-config.ts).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Yellow "Database not configured" box | `MONGODB_URI` missing in `.env.local`; restart `npm run dev` after editing env files. |
| `MongoServerSelectionError` / timeouts | Your IP isn't in Atlas **Network Access**, the cluster is paused (M0 pauses after inactivity — resume it), or a firewall blocks port 27017. |
| `bad auth : authentication failed` | Wrong DB user/password; URL-encode special characters in the password. |
| `not authorized on amarelaka… to execute command` | The DB user lacks `readWrite` on the database named in `MONGODB_DB`. |
| `Document failed validation` | Data doesn't match the schema validators — run `npm run db:migrate`; check you're not writing extra types from custom scripts. |
| Map is grey | Tile URL wrong/blocked or rate-limited; check browser devtools network tab. CSP allows any `https:` image source. |
| Photo upload rejected | Only JPG/PNG/WebP ≤ 5 MB; animated images rejected. On Vercel the platform body limit is ~4.5 MB (the client compresses photos first). |
| Every guest shares one rate-limit bucket | Set `TRUST_PROXY=true` when deployed behind a proxy that sets `X-Forwarded-For`. |
| `sharp` install errors | Use Node 20.9+; delete `node_modules` and reinstall on the target OS (sharp ships per-platform binaries). |
| Tests hang on first run | `mongodb-memory-server` is downloading `mongod`; allow network access once, or set `MONGOMS_SYSTEM_BINARY` to a local `mongod`. |

---

## Known limitations (summary)

See [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) for the full list. Highlights:
- No email verification or password reset yet (needs a paid/limited email provider) — accounts are email + password only.
- Photos are stored in MongoDB GridFS (no extra service) — fine for an MVP but Atlas M0 has 512 MB total storage; move to object storage (S3/R2) as volume grows.
- Area boundaries are approximate rectangles, not official ward/thana boundaries.
- The Open Graph share image uses English area names (the default OG font has no Bangla glyphs).
- No offline caching/service worker; offline state is detected and shown, and the list view works without map tiles.
- Legal pages are drafts; **review by a qualified Bangladesh legal professional is required before public launch.**
