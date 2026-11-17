# Architecture

## Overview

```
Browser (React client components)
  │  fetch() JSON / multipart — same-origin only
  ▼
Next.js App Router (Node.js runtime)
  ├─ Server components (pages) ── read via services ──┐
  ├─ Route handlers  /api/*  ── Zod validation ───────┤
  │     handler() wrapper → consistent error JSON      │
  │     assertSameOrigin() on every mutation (CSRF)    │
  ▼                                                     ▼
src/server/services/*   (authorization + business rules; the ONLY code that touches the DB)
  ├─ dto.ts             public projections (no reporter, no exact coords, no moderation notes)
  ├─ rate-limit.ts      fixed-window counters in MongoDB (TTL)
  └─ auth/              scrypt passwords, hashed session tokens
  ▼
MongoDB Atlas  (collections with $jsonSchema validators, unique + 2dsphere + TTL indexes, GridFS for photos)
```

Key decisions:

| Decision | Why |
|---|---|
| **Route handlers for all mutations** (no server actions) | One explicit, testable HTTP surface; integration tests call the real handlers. |
| **Pure domain logic in `src/lib`** (`status.ts`, `freshness.ts`, `geo.ts`, `moderation-rules.ts`, `validation.ts`) | Deterministic, unit-tested, shared by client and server. |
| **Server-only modules** (`import "server-only"`) for DB/auth/services | A client bundle that imports them fails the build. |
| **No ORM** — official MongoDB driver + typed collections | Fewer moving parts for one intermediate developer; Zod + DB validators cover shape. |
| **Custom email/password sessions** | No third-party auth cost; tokens are random 256-bit values, only their SHA-256 hash is stored; httpOnly + SameSite=Lax cookies. |
| **Photos in GridFS** | No extra paid service for the MVP. `services/photos.ts` is the boundary to swap for S3/R2 later. |
| **Map loaded lazily** (`next/dynamic`, `ssr:false`) | Leaflet code only loads on pages with maps; list view works without it. |
| **Plain `<img>` instead of `next/image`** | Photos are already resized/re-encoded server-side; avoids paid image-optimisation quotas on hosts. |
| **Cookie-based locale, no locale prefix in URLs** | Share links stay stable regardless of the sharer's language; Accept-Language picks the default (Bangla first). |

## Request flow examples

**Create report** `POST /api/issues` (multipart)
1. Same-origin check → body size check → session lookup (sign-in required).
2. Zod: category, title length, coordinates within Bangladesh, no phone/email/ID numbers/links, honeypot.
3. Rate limits per user and per hashed IP.
4. Duplicate search (same category, open, recent, within category radius) → `409` with candidates unless the user confirmed "submit anyway".
5. Photo: MIME allow-list + magic-byte check via sharp → rotate → resize → WebP (metadata dropped).
6. Write `issues` (approximate grid-snapped point), `issue_private` (reporter id, IP hash), `issue_exact_locations` (TTL 90 days), `issue_updates` ("created"), GridFS + `issue_photos` (pending).

**Vote** `POST /api/issues/:id/votes`
1. Issue must be public and not archived; "fixed" requires an account; reporters can't confirm their own report.
2. Rate limit; insert vote — the unique index `{issueId, round, voterKey, kind}` rejects repeats (`409`).
3. Update counters/freshness; append public history; recompute status with an optimistic lock on `{round, status}`.

## Status model

Public **status** (`reported → community_verified → community_resolved`, plus `under_review`, `archived`) is separate from **moderation state** (`visible | pending | hidden | rejected | merged | removed`). See `src/lib/status.ts`:

- Verified: ≥ `verifyThreshold` (2) distinct "present" confirmations.
- Community-reported resolved: ≥ `resolutionThreshold` (2, clamped ≥ 2) distinct **account** "fixed" reports within `resolutionWindowHours` (48), and at least as many as recent "present" confirmations.
- Reopen: ≥ `reopenThreshold` (2) distinct "present" confirmations after resolution. Each resolve/reopen advances a `round` so people can respond again.
- `under_review` (moderator, or automatic after 3 open flags) and `archived` freeze the community machine.

## Performance budget (targets, not measured guarantees)

- Shared JS ≈ 103 kB gzip; Explore first load ≈ 129 kB + Leaflet chunk loaded lazily.
- List pages 20 items; map markers capped at 300 per viewport; requests debounced and aborted when the map moves.
- Photos ≤ 1280 px WebP (q72) and 320 px thumbnails; client compresses to ≤ 1600 px JPEG before upload.
- API GETs send short `Cache-Control` (15–300 s) to let CDNs absorb bursts.
- Known gap: no service worker/offline cache; no marker clustering (cap + filters instead).
