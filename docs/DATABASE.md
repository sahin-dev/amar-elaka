# Database (MongoDB Atlas)

The original brief mentioned SQL migrations, PostGIS and Supabase RLS. This project uses **MongoDB** as requested, so the equivalents are:

| Brief | This implementation |
|---|---|
| Version-controlled SQL migrations | `migrations/NNN_*.ts`, applied in order by `npm run db:migrate`, recorded in `_migrations` |
| Constraints / foreign keys | `$jsonSchema` validators (`validationLevel: strict`), unique indexes, application-enforced references (MongoDB has no FK constraints) |
| PostGIS | GeoJSON points/polygons with **2dsphere** indexes (`$geoWithin`, `$geoIntersects`, `$centerSphere`) |
| Row Level Security | Server-only data-access layer + least-privilege Atlas user — see [SECURITY.md](SECURITY.md) |
| UUID primary keys | `_id` is a `crypto.randomUUID()` string (sessions / rate limits use hashed keys) |

## Collections and relationships

```
areas 1 ──< issues >── 1 issue_private ──> profiles (reporterId, nullable after deletion)
                 │  └── 1 issue_exact_locations (TTL)
                 ├──< issue_photos ──> GridFS photos.files / photos.chunks
                 ├──< issue_updates   (public history)
                 ├──< issue_votes     ──> profiles (userId, nullable)
                 ├──< issue_flags     ──> profiles (userId, nullable)
                 └──< moderation_events ──> profiles (actorId, internal)
profiles 1 ──< sessions
rate_limits (standalone, TTL)
polls 1 ──< poll_votes (one per HMAC(IP) and browser profile per poll)
       └──< poll_events (moderator actions)
```

| Collection | Purpose | Public? |
|---|---|---|
| `areas` | slug, bilingual name/city, centre point, boundary polygon | yes |
| `profiles` | email, scrypt hash, optional display name, role, locale | **no** (owner only) |
| `sessions` | `_id` = SHA-256(token), userId, expiresAt (TTL) | no |
| `issues` | category, title, description, **approximate** location, areaId, `status`, `moderationState`, round, counters, timestamps, mergedInto, possibleDuplicateOf, publicPhotoId, previousStatus | yes, via DTO, only when `moderationState = visible` |
| `issue_private` | reporterId, reporter IP HMAC | moderators (opaque refs only) |
| `issue_exact_locations` | exact point, `expiresAt` (90-day TTL) | moderators |
| `issue_photos` | GridFS file ids (main + thumb), size, moderation state, uploader | approved only |
| `issue_updates` | append-only public history: type, actorKind (community/moderator/system), from/to status | yes (no identities) |
| `issue_votes` | issueId, round, voterKey (`u:`/`g:`/`d:`), userId, kind | no (aggregates only) |
| `issue_flags` | reason, details, flaggerKey, state | moderators |
| `moderation_events` | audit log: action, actor, from/to, internal note | moderators |
| `rate_limits` | fixed-window counters (TTL) | no |
| `polls` | question, topic, source/context, options, status, deadline and creator | yes, through a public DTO |
| `poll_votes` | pollId, HMAC(IP), HMAC(signed browser ID), optionId, createdAt | no (only aggregate counts are public) |
| `poll_events` | moderator created/closed/reopened actions | moderators / database operators |

## Indexes (from `001_initial_schema.ts`)

- `areas`: `slug` unique; `boundary` 2dsphere
- `profiles`: `email` unique; `role`
- `sessions`: `userId`; `expiresAt` TTL
- `issues`: `location` 2dsphere; `{moderationState, status, lastActivityAt}`; `{areaId, moderationState, lastActivityAt}`; `{category, moderationState, lastActivityAt}`; `createdAt`; `status`; partial `counts.openFlags > 0`
- `issue_votes`: **unique `{issueId, round, voterKey, kind}`** (DB-level duplicate-vote prevention)
- `poll_votes`: **unique `{pollId, voterKey}` and `{pollId, deviceKey}`** (one vote per IP and browser profile per poll); option totals grouped for display
- `issue_flags`: **unique `{issueId, flaggerKey}`**; `{state, createdAt}`
- `issue_updates`: `{issueId, createdAt}`; `moderation_events`: by issue, actor, time
- TTL: `sessions.expiresAt`, `issue_exact_locations.expiresAt`, `rate_limits.expiresAt`

## Location queries

- Viewport: `location: { $geoWithin: { $geometry: <bbox polygon> } }` (uses the 2dsphere index).
- Duplicates: `$geoWithin: { $centerSphere: [[lng, lat], radiusMeters / 6378100] }`.
- Area assignment: `areas.boundary: { $geoIntersects: { $geometry: point } }` using the **exact** point (server-side only).
- Public coordinates are snapped to a 0.0015° grid (~165 m) centre — deterministic, so repeated reports can't be averaged to find a home.

## Retention

| Data | Retention |
|---|---|
| Exact coordinates | 90 days (TTL), or immediately on account deletion with "remove reports" |
| Sessions | 30 days (TTL) or until sign-out / deletion |
| Rate-limit counters | one window (TTL) |
| Rejected photos | deleted at rejection |
| Votes/flags of deleted accounts | kept, unlinked (`d:<random>` key) so histories stay consistent |
| Poll vote identities | keyed IP and browser-token hashes retained with votes; browser token cookie lasts one year and can be cleared by the user |
| Moderation events | kept (audit). Decide a retention period with legal review. |

## Writing a new migration

1. Add the next numbered migration file (for example `migrations/004_description.ts`) exporting `up(db)`; make it idempotent.
2. Append it to `MIGRATIONS` in `migrations/index.ts`.
3. Run `npm run db:migrate` against dev, then production. Never edit an applied migration.
