# Deployment (low budget)

Recommended starter setup: **Vercel Hobby or Render (free/starter) + MongoDB Atlas M0 + a tile provider free tier**. Check each provider's current terms; free tiers change and some forbid commercial use (e.g. Vercel Hobby is for non-commercial projects).

## 1. Production database

1. In Atlas, create a production cluster (M0 to start; M10+ when you need backups/SLAs).
2. Create a database user with `readWrite` on `amarelaka` only.
3. From your machine (with production env vars in a separate file you don't commit):
   ```bash
   MONGODB_URI="mongodb+srv://…" MONGODB_DB=amarelaka npm run db:migrate
   MONGODB_URI="mongodb+srv://…" MONGODB_DB=amarelaka npm run db:seed:areas
   ```
   Do **not** run `db:seed:dev` (it refuses unless `ALLOW_DEV_SEED=true`, and refuses databases with "prod" in the name).

### Atlas network access
Serverless hosts use changing egress IPs. Options:
- Simplest: allow `0.0.0.0/0` **and** rely on a strong, unique DB password (Atlas still requires TLS + auth). Acceptable for an MVP; document the risk.
- Better: a host with static egress IPs (Render paid, Fly.io dedicated IPv4, Vercel Secure Compute) and allow only those.

## 2a. Vercel

1. Push the repo to GitHub → **Import** in Vercel (framework auto-detected).
2. Environment variables (Production): `MONGODB_URI`, `MONGODB_DB=amarelaka`, `APP_URL=https://your-domain`, `IP_HASH_SECRET`, `TRUST_PROXY=true`, map variables, `PHOTOS_REQUIRE_APPROVAL=true`.
   Poll voting depends on the host's trusted proxy setting to deliver the real client IP. Confirm that the host strips or safely overwrites user-supplied forwarding headers; direct-origin deployments must not enable `TRUST_PROXY` until this is confirmed. Run `npm run db:migrate` to install the poll collections/indexes before serving poll traffic.
3. Region: choose one near your Atlas region (e.g. `bom1` Mumbai with Atlas `ap-south-1`).
4. Notes: request bodies are capped at ~4.5 MB on Vercel functions (the client compresses photos first); `sharp` is supported on Vercel's Node runtime.

## 2b. Render (or any Node host)

```bash
npm ci && npm run build      # build command
npm run start                # start command (PORT is respected by next start via -p $PORT if needed)
```
Set the same env vars. Set `TRUST_PROXY=true` (Render sets `X-Forwarded-For`). Free instances sleep when idle — the first request after sleep is slow.

## 3. After deploy

- [ ] `GET /api/health` returns `{ ok: true, db: "up" }`.
- [ ] Sign up, then `npm run user:role -- you@… admin` against production.
- [ ] Paste an `/areas/<slug>` link into WhatsApp/Messenger and confirm the share card shows (requires the correct `APP_URL`).
- [ ] Switch tiles to a provider plan; confirm attribution is visible.
- [ ] Set up uptime monitoring on `/api/health` and Atlas alerts (connections, storage).
- [ ] Run through [MANUAL_TEST_CHECKLIST.md](MANUAL_TEST_CHECKLIST.md) on a real low-end Android phone over 3G throttling.

## Scaling notes

- Storage: GridFS photos (~150–250 KB each incl. thumbnail) use Atlas storage; M0 has 512 MB total. Move photos to S3/Cloudflare R2 by replacing `src/server/services/photos.ts`.
- Connections: one pooled client per instance (max 10). M0 allows ~500 connections.
- Rate limits and sessions already live in the DB, so multiple instances are safe.
