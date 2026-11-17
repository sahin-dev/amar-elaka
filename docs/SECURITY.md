# Security, privacy and access control

## "Row Level Security" equivalent for MongoDB

Supabase/Postgres RLS doesn't exist in MongoDB, and Atlas permissions work per database/collection, not per document. AmarElaka gets the same guarantees this way:

1. **The browser never talks to the database.** The connection string exists only in server env vars. `src/server/**` modules import `server-only`, so bundling them into client code fails the build.
2. **Every read path goes through a service that applies the visibility rule** and a DTO mapper (`src/server/dto.ts`) that whitelists public fields:

| Data | Anonymous | Resident (self) | Other residents | Moderator / admin |
|---|---|---|---|---|
| Visible issue (approx. location, text, status, history) | ✅ | ✅ | ✅ | ✅ |
| Pending / hidden / rejected issue | ❌ 404 | ✅ own only | ❌ 404 | ✅ |
| Removed (author-deleted) issue | ❌ | ❌ | ❌ | ✅ |
| Exact location | ❌ | export only | ❌ | ✅ (until TTL) |
| Reporter identity | ❌ | ❌ | ❌ | opaque reference only |
| Unapproved photo | ❌ | ❌ | ❌ | ✅ |
| Profile (email, name) | ❌ | ✅ own | ❌ | ❌ (not exposed in UI) |
| Moderation notes / audit log / flags | ❌ | ❌ | ❌ | ✅ |

3. **Every write derives the actor from the session**, never from the request body. `PATCH /api/account` ignores `id`, `userId` and `role` (tested). Roles change only via `npm run user:role` (DB access required).
4. **Database-level guards:** `$jsonSchema` validators, unique indexes (votes, flags, emails), TTL deletion.
5. **Least-privilege Atlas user:** the app user gets `readWrite` on its own database only, never `atlasAdmin` or `dbAdmin`. Optionally, create a separate user for migrations and give the runtime user a custom role without `dropCollection` / `dropDatabase` (Atlas UI → Database Access → Custom Roles: `find`, `insert`, `update`, `remove`, `createIndex` on the app DB).

Tests: `tests/integration/*.test.ts` cover visibility, moderation permission denial for anonymous users and residents, and own-profile isolation.

## Controls implemented

| Threat | Control |
|---|---|
| CSRF | `assertSameOrigin` on every POST/PATCH/DELETE (Origin must match the host or `APP_URL`) + `SameSite=Lax` httpOnly cookies |
| Session theft | 256-bit random token; only SHA-256 stored; `Secure` in production; 30-day TTL; deleted on sign-out and account deletion |
| Password attacks | scrypt (N=16384, r=8, p=1); login rate limits per IP and per email; same error and similar timing for unknown emails (dummy hash) |
| Spam / abuse | Sign-in required to report; honeypot; per-user + per-IP-hash rate limits; links rejected; duplicate detection; auto under-review after 3 flags |
| Vote manipulation | One vote per kind per voter per round (DB unique index); "fixed" needs an account; ≥ 2 independent resolvers; reporter can't self-confirm; guest votes keyed by HMAC(IP) and rate-limited |
| Poll stuffing | Unique `{pollId, voterKey}` and `{pollId, deviceKey}` indexes enforce one poll vote per HMAC(IP) and signed browser-profile token; vote endpoints are rate-limited; production rejects voting when the trusted proxy IP is unavailable; open poll totals are hidden until the IP votes |
| Doxxing / personal data | Phone (Latin + Bangla digits), email, NID-length numbers rejected in text; grid-snapped public coordinates; photo approval gate; guidelines + warnings in the form |
| Malicious uploads | MIME allow-list **and** decoded-format check (sharp), pixel limit, no animation, re-encode to WebP (drops EXIF/GPS/XMP/ICC), server-generated storage paths, `nosniff`, `Content-Disposition: inline`, served as `image/webp` only |
| XSS | React escaping; no `dangerouslySetInnerHTML` with user content; CSP (`script-src 'self' 'unsafe-inline'`, `object-src 'none'`, `frame-ancestors 'none'`) |
| Open redirect | `safeNext()` allows relative paths only |
| Info leakage | `handler()` maps unknown errors to a generic 500 and logs server-side; Zod errors return field messages only; `/api/health` reveals no config |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| Injection | Zod-typed inputs; regex search terms escaped; slugs and IDs validated by pattern before querying |

## Requires human review before launch

- [ ] Legal review (Bangladesh) of guidelines, privacy notice, data retention, and moderation/defamation process — **the in-app pages are drafts and make no compliance claims**.
- [ ] Penetration test / independent security review.
- [ ] CSP: consider nonces to drop `'unsafe-inline'` for scripts.
- [ ] Email verification + password reset (needs an email provider) — currently absent.
- [ ] Moderator onboarding, escalation and response-time policy; appeal handling SLA.
- [ ] Atlas: backups (M0 has no automated backups — use M10+ or scheduled `mongodump`), alerts, IP access list, 2FA on the Atlas account.
- [ ] Rotate `IP_HASH_SECRET` policy (rotation resets guest and poll-device de-duplication).
- [ ] Decide retention for moderation events, flags and votes.
- [ ] Verify the chosen host overwrites or safely appends its client IP header before enabling `TRUST_PROXY`; do not trust client-supplied `X-Forwarded-For` at a directly exposed origin.
- [ ] Explain shared-network limits in poll guidance: people behind the same public IP share one poll vote.
