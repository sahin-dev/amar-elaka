# Status, known limitations and launch checklist

## Completed (implemented and covered by automated tests and/or a local HTTP smoke test)

- App shell: responsive layout, mobile bottom nav with Report FAB, desktop header, skip link, offline banner, skeleton/empty/error/success states.
- Bangla/English localisation (cookie + Accept-Language, Bangla default), Bangla digits and dates.
- MongoDB schema with validators, indexes, TTLs and a migration runner; production-safe area seed; guarded dev seed; role CLI.
- Email/password auth with hashed sessions; account settings, my reports, JSON export, account deletion with anonymisation.
- Explore map + list with bbox queries, filters, area search, summary, pagination, URL state.
- Reporting with validation, personal-info and link rejection, honeypot, duplicate detection, photo upload with EXIF/GPS stripping, approximate public location, 90-day exact-location retention.
- Issue detail with freshness, history, confirm/fixed/flag, share; Open Graph metadata.
- Community status machine (verify, resolve with ≥ 2 independent accounts in 48 h, reopen), auto-review after flags.
- Moderation dashboard and actions with an audit log; photo approval.
- Rate limiting (DB-backed), CSRF origin checks, security headers/CSP, consistent API errors.
- Area pages with stats and an Open Graph share image.
- Tests: 74 automated tests passing locally (unit + integration against in-process MongoDB).

## Not verified here (needs your environment)

- Running against **your MongoDB Atlas cluster** — development and tests used a local in-process MongoDB because no Atlas credentials were available. Atlas M0 supports all features used (2dsphere, TTL, `$jsonSchema`, GridFS), but run `npm run db:migrate` and the checklist on Atlas.
- Deployment to a real host, real-device mobile testing, screen-reader testing, and real tile-provider quotas.

## Known limitations

- No email verification, password reset, or notifications (requires an email provider).
- Guest confirmations are keyed by an IP hash: people behind shared/CGNAT mobile IPs (common in Bangladesh) can collide (one guest vote per IP per issue), and determined users can evade them. "Fixed" votes require accounts for this reason.
- Duplicate detection is simple (category + radius + recency); moderators make the final call with Merge.
- Merging doesn't move votes or photos to the target report.
- Area boundaries are approximate rectangles; reports outside them show "Outside mapped areas".
- The OG share image uses English area names (the default font lacks Bangla glyphs; bundling a Bangla TTF would fix this).
- No marker clustering; markers are capped at 300 per view.
- Photos in GridFS count against Atlas storage (512 MB on M0).
- No service worker or offline report drafts.
- One photo per report.
- Times in history are relative; absolute time shows on hover only (desktop).
- Moderators see opaque reporter references, not identities; contacting reporters isn't supported.

## Security steps still requiring human review

See [SECURITY.md → Requires human review](SECURITY.md#requires-human-review-before-launch). Most important:
1. **Legal review by a qualified Bangladesh legal professional** of the guidelines, privacy notice, retention, takedown/appeal process and defamation risk. The app makes no legal-compliance claims.
2. Independent security review / penetration test.
3. Atlas hardening: backups, 2FA, IP access list, alerts, least-privilege user.
4. Moderator staffing and response-time commitments before announcing publicly.
5. Tile provider with a proper plan and attribution.
6. Email verification and password reset before scaling sign-ups.
