# External services that need setup or may cost money

No service is assumed to have unlimited free usage. Limits below are as generally published at the time of writing — **verify current pricing and terms before launch.**

| Service | Needed for | Free option | Limits / cost risk | Required? |
|---|---|---|---|---|
| **MongoDB Atlas** | All data, sessions, rate limits, photos (GridFS) | M0 shared cluster | 512 MB storage, shared CPU, limited ops/connections, **no automated backups**, pauses after long inactivity. Paid dedicated clusters (M10+) for backups/SLAs. | Yes |
| **Hosting** (Vercel / Render / Fly / VPS) | Running Next.js | Vercel Hobby (non-commercial), Render free (sleeps) | Function execution time, bandwidth and request limits; body-size caps (Vercel ~4.5 MB) | Yes |
| **Map tiles** | Map background | Public OSM tiles (dev only); MapTiler / Stadia / Thunderforest / Jawg free tiers | OSM policy forbids heavy use; commercial providers bill per tile/map load beyond the free quota. Usage grows with every pan/zoom. | Yes (choose a provider) |
| **Domain + DNS** | Public URL, share links | — | ~annual fee | Recommended |
| **Email provider** (not yet integrated) | Email verification, password reset, moderator alerts | Limited free tiers (e.g. Resend, Brevo, SES with low limits) | Per-email cost beyond quota; sender-domain setup | Recommended before launch |
| **Object storage** (not yet integrated) | Photos at scale | Cloudflare R2 / S3 free tiers | Storage + egress (R2 has no egress fees) | Later |
| **Error monitoring** (optional) | Production error tracking | Sentry free tier | Event quotas | Optional |
| **Uptime monitoring** (optional) | `/api/health` checks | UptimeRobot / Better Stack free tiers | Check frequency limits | Optional |

Nothing in the codebase calls a paid API. The build fetches fonts from Google Fonts at **build time** (via `next/font`) and self-hosts them; no runtime calls to Google.
