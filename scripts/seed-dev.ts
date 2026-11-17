/**
 * DEVELOPMENT-ONLY sample data. Never run against production.
 *
 * Guards: requires ALLOW_DEV_SEED=true, NODE_ENV !== "production", and a
 * database name that does not contain "prod". Every document it creates is
 * tagged `devSeed: true` so `npm run db:seed:dev -- --reset` can remove it.
 *
 * All reports below are fictional examples for UI development; they are not
 * real conditions or official data.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { approximateLocation } from "../src/lib/geo";
import { hashPassword } from "../src/server/auth/password";
import { connect, loadEnv } from "./lib/connect";

loadEnv();

const DEV_PASSWORD = "dev-password-123";

type Cat = "waterlogging" | "pothole" | "streetlight" | "garbage" | "blocked_road" | "other";
type Status = "reported" | "community_verified" | "under_review" | "community_resolved";

const SAMPLES: { cat: Cat; title: string; desc: string; lat: number; lng: number; hoursAgo: number; status: Status; present: number; fixed: number }[] = [
  { cat: "waterlogging", title: "Knee-deep water after rain on Road 10", desc: "Water has not drained since last night's rain. Rickshaws are struggling to pass.", lat: 23.8065, lng: 90.3681, hoursAgo: 3, status: "community_verified", present: 4, fixed: 0 },
  { cat: "pothole", title: "Large pothole near Section 2 bus stop", desc: "Motorbikes swerve into traffic to avoid it.", lat: 23.8051, lng: 90.3622, hoursAgo: 20, status: "reported", present: 1, fixed: 0 },
  { cat: "streetlight", title: "Three streetlights out along the lake road", desc: "The stretch is very dark after 8pm.", lat: 23.7462, lng: 90.3775, hoursAgo: 30, status: "community_verified", present: 3, fixed: 0 },
  { cat: "garbage", title: "Overflowing garbage point beside the market", desc: "Waste spilling onto the footpath; strong smell.", lat: 23.7655, lng: 90.3571, hoursAgo: 50, status: "reported", present: 0, fixed: 0 },
  { cat: "blocked_road", title: "Construction material blocking half the lane", desc: "Sand and bricks left on the road for several days.", lat: 23.7932, lng: 90.4145, hoursAgo: 8, status: "reported", present: 1, fixed: 0 },
  { cat: "waterlogging", title: "Drain overflow at the intersection", desc: "Blocked drain causes flooding whenever it rains.", lat: 23.7801, lng: 90.4301, hoursAgo: 100, status: "reported", present: 0, fixed: 0 },
  { cat: "pothole", title: "Broken road surface near the school gate", desc: "", lat: 23.7529, lng: 90.4282, hoursAgo: 140, status: "community_resolved", present: 2, fixed: 2 },
  { cat: "streetlight", title: "Flickering streetlight at the corner", desc: "Light turns on and off all night.", lat: 23.7325, lng: 90.4168, hoursAgo: 12, status: "reported", present: 0, fixed: 0 },
  { cat: "garbage", title: "Garbage dumped in the open plot", desc: "Recurring dumping; attracts stray dogs.", lat: 23.7098, lng: 90.4071, hoursAgo: 70, status: "community_verified", present: 2, fixed: 0 },
  { cat: "other", title: "Open manhole cover on the footpath", desc: "Dangerous for pedestrians at night.", lat: 23.8752, lng: 90.3801, hoursAgo: 5, status: "community_verified", present: 4, fixed: 0 },
  { cat: "waterlogging", title: "Waterlogged lane behind the mosque", desc: "Water has been standing for two days.", lat: 22.3251, lng: 91.8125, hoursAgo: 40, status: "reported", present: 1, fixed: 0 },
  { cat: "blocked_road", title: "Fallen tree branch partly blocking road", desc: "", lat: 24.8951, lng: 91.8691, hoursAgo: 2, status: "reported", present: 0, fixed: 0 },
  { cat: "pothole", title: "Series of potholes on the main road", desc: "Several deep holes over about 100 m.", lat: 23.7641, lng: 90.3931, hoursAgo: 200, status: "community_resolved", present: 3, fixed: 3 },
  { cat: "garbage", title: "Uncollected waste for a week", desc: "Collection has not happened this week.", lat: 22.8167, lng: 89.5473, hoursAgo: 26, status: "reported", present: 1, fixed: 0 },
];

function guard(dbName: string) {
  const problems: string[] = [];
  if (process.env.ALLOW_DEV_SEED !== "true") problems.push("ALLOW_DEV_SEED is not \"true\"");
  if (process.env.NODE_ENV === "production") problems.push("NODE_ENV is production");
  if (/prod/i.test(dbName)) problems.push(`database name "${dbName}" looks like production`);
  if (problems.length) {
    console.error(`Refusing to seed development data: ${problems.join("; ")}.`);
    process.exit(1);
  }
}

async function reset(db: Db) {
  for (const name of ["profiles", "sessions", "issues", "issue_private", "issue_exact_locations", "issue_updates", "issue_votes", "issue_flags"]) {
    const r = await db.collection(name).deleteMany({ devSeed: true });
    if (r.deletedCount) console.log(`  removed ${r.deletedCount} from ${name}`);
  }
}

async function main() {
  const { client, db, dbName } = await connect();
  guard(dbName);
  try {
    if (process.argv.includes("--reset")) {
      console.log("Removing previous dev seed data…");
      await reset(db);
      if (process.argv.includes("--only-reset")) return;
    }
    if (await db.collection("issues").countDocuments({ devSeed: true })) {
      console.log("Dev seed data already present. Use `npm run db:seed:dev -- --reset` to recreate it.");
      return;
    }
    const areas = await db.collection<{ _id: string; boundary: unknown }>("areas").find({}).toArray();
    if (!areas.length) {
      console.error("No areas found. Run `npm run db:seed:areas` first.");
      process.exit(1);
    }

    const now = Date.now();
    const pw = await hashPassword(DEV_PASSWORD);
    const mkUser = (email: string, role: string, displayName: string) => ({
      _id: randomUUID(),
      email,
      passwordHash: pw,
      displayName,
      role,
      locale: "bn",
      createdAt: new Date(now),
      updatedAt: new Date(now),
      lastLoginAt: null,
      devSeed: true,
    });
    const users = [
      mkUser("moderator@example.test", "moderator", "Dev Moderator"),
      mkUser("resident1@example.test", "resident", "Dev Resident 1"),
      mkUser("resident2@example.test", "resident", "Dev Resident 2"),
      mkUser("resident3@example.test", "resident", "Dev Resident 3"),
      mkUser("resident4@example.test", "resident", "Dev Resident 4"),
      mkUser("resident5@example.test", "resident", "Dev Resident 5"),
    ];
    await db.collection("profiles").insertMany(users as never[]);
    const residents = users.slice(1);

    for (const [i, s] of SAMPLES.entries()) {
      const id = randomUUID();
      const created = new Date(now - s.hoursAgo * 3_600_000);
      const approx = approximateLocation({ lat: s.lat, lng: s.lng });
      const area = await db
        .collection<{ _id: string }>("areas")
        .findOne({ boundary: { $geoIntersects: { $geometry: { type: "Point", coordinates: [s.lng, s.lat] } } } });
      const reporter = residents[i % residents.length]!;
      const voters = residents.filter((r) => r._id !== reporter._id);
      const lastConfirmed = s.present ? new Date(created.getTime() + Math.min(s.hoursAgo, 2) * 3_600_000 * 0.5) : null;
      const resolvedRound = s.status === "community_resolved" ? 1 : 0;

      await db.collection("issues").insertOne({
        _id: id,
        category: s.cat,
        title: s.title,
        description: s.desc,
        location: { type: "Point", coordinates: [approx.lng, approx.lat] },
        areaId: area?._id ?? null,
        status: s.status,
        moderationState: "visible",
        round: resolvedRound,
        counts: { present: s.present, fixed: s.fixed, openFlags: 0 },
        createdAt: created,
        updatedAt: created,
        lastConfirmedAt: lastConfirmed,
        lastActivityAt: lastConfirmed ?? created,
        resolvedAt: s.status === "community_resolved" ? new Date(now - 6 * 3_600_000) : null,
        mergedInto: null,
        possibleDuplicateOf: [],
        publicPhotoId: null,
        photoPending: false,
        previousStatus: null,
        devSeed: true,
      } as never);
      await db.collection("issue_private").insertOne({ _id: id, reporterId: reporter._id, reporterIpKey: "dev-seed", createdAt: created, devSeed: true } as never);
      await db.collection("issue_exact_locations").insertOne({
        _id: id,
        location: { type: "Point", coordinates: [s.lng, s.lat] },
        expiresAt: new Date(created.getTime() + 90 * 86_400_000),
        devSeed: true,
      } as never);
      const updates: Record<string, unknown>[] = [{ type: "created", toStatus: "reported", at: created }];
      for (let v = 0; v < s.present; v++) {
        const voter = voters[v % voters.length]!;
        const at = new Date(created.getTime() + (v + 1) * 600_000);
        await db.collection("issue_votes").insertOne({
          _id: randomUUID(), issueId: id, round: 0, voterKey: `u:${voter._id}`, userId: voter._id, kind: "present", createdAt: at, devSeed: true,
        } as never);
        updates.push({ type: "confirmed_present", at });
      }
      if (s.status === "community_verified" || s.status === "community_resolved") {
        updates.push({ type: "status_changed", toStatus: "community_verified", at: new Date(created.getTime() + 1_300_000) });
      }
      for (let v = 0; v < s.fixed; v++) {
        const voter = voters[(v + 2) % voters.length]!;
        const at = new Date(now - (7 - v) * 3_600_000);
        await db.collection("issue_votes").insertOne({
          _id: randomUUID(), issueId: id, round: 0, voterKey: `u:${voter._id}`, userId: voter._id, kind: "fixed", createdAt: at, devSeed: true,
        } as never);
        updates.push({ type: "reported_fixed", at });
      }
      if (s.status === "community_resolved") updates.push({ type: "status_changed", toStatus: "community_resolved", at: new Date(now - 6 * 3_600_000) });
      await db.collection("issue_updates").insertMany(
        updates.map((u) => ({
          _id: randomUUID(),
          issueId: id,
          type: u.type,
          actorKind: "community",
          fromStatus: null,
          toStatus: (u.toStatus as string) ?? null,
          createdAt: u.at,
          devSeed: true,
        })) as never[],
      );
    }

    console.log(`Seeded ${users.length} dev accounts and ${SAMPLES.length} fictional reports into "${dbName}".`);
    console.log(`Dev login: moderator@example.test / resident1@example.test … password: ${DEV_PASSWORD}`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("Dev seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
