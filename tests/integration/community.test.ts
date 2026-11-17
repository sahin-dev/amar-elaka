import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as votePOST } from "@/app/api/issues/[id]/votes/route";
import { POST as flagPOST } from "@/app/api/issues/[id]/flags/route";
import { GET as detailGET } from "@/app/api/issues/[id]/route";
import { collections, getDb } from "@/server/db";
import { hitRateLimit } from "@/server/rate-limit";
import { makeIssue, makeUser, params, req, resetDb } from "../helpers/fixtures";

beforeEach(resetDb);

const vote = (id: string, kind: "present" | "fixed", opts: { token?: string; ip?: string } = {}) =>
  votePOST(req(`/api/issues/${id}/votes`, { method: "POST", json: { kind }, ...opts }), params({ id }));

describe("community confirmations", () => {
  it("prevents the same account from voting twice", async () => {
    const reporter = await makeUser();
    const a = await makeUser();
    const { id } = await makeIssue(reporter);
    expect((await vote(id, "present", { token: a.token })).status).toBe(200);
    const again = await vote(id, "present", { token: a.token });
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("CONFLICT");
  });

  it("enforces uniqueness at the database level too", async () => {
    const reporter = await makeUser();
    const { id } = await makeIssue(reporter);
    const c = collections(await getDb());
    const doc = { issueId: id, round: 0, voterKey: "u:x", userId: null, kind: "present" as const, createdAt: new Date() };
    await c.issueVotes.insertOne({ _id: randomUUID(), ...doc });
    await expect(c.issueVotes.insertOne({ _id: randomUUID(), ...doc })).rejects.toMatchObject({ code: 11000 });
  });

  it("does not let reporters confirm their own report", async () => {
    const reporter = await makeUser();
    const { id } = await makeIssue(reporter);
    expect((await vote(id, "present", { token: reporter.token })).status).toBe(403);
  });

  it("requires an account to report fixed", async () => {
    const reporter = await makeUser();
    const { id } = await makeIssue(reporter);
    expect((await vote(id, "fixed", { ip: "1.2.3.4" })).status).toBe(401);
  });

  it("de-duplicates guest confirmations by hashed client key", async () => {
    process.env.TRUST_PROXY = "true";
    const reporter = await makeUser();
    const { id } = await makeIssue(reporter);
    expect((await vote(id, "present", { ip: "5.6.7.8" })).status).toBe(200);
    expect((await vote(id, "present", { ip: "5.6.7.8" })).status).toBe(409);
    expect((await vote(id, "present", { ip: "9.9.9.9" })).status).toBe(200);
    // Raw IPs are never stored.
    const votes = await collections(await getDb()).issueVotes.find({ issueId: id }).toArray();
    expect(JSON.stringify(votes)).not.toContain("5.6.7.8");
    process.env.TRUST_PROXY = "false";
  });

  it("walks through verify → community resolved → reopen, with history", async () => {
    const reporter = await makeUser();
    const [a, b, c, d] = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()]);
    const { id } = await makeIssue(reporter);

    await vote(id, "present", { token: a.token });
    const v2 = await (await vote(id, "present", { token: b.token })).json();
    expect(v2.status).toBe("community_verified");

    const f1 = await (await vote(id, "fixed", { token: c.token })).json();
    expect(f1.status).toBe("community_verified"); // one fixed vote never resolves
    // Two independent fixed reports, at least matching the present confirmations in the window.
    const f2 = await (await vote(id, "fixed", { token: d.token })).json();
    expect(f2.status).toBe("community_resolved");

    // After resolution, earlier voters can confirm again (new round) and reopen it.
    await vote(id, "present", { token: a.token });
    const re = await (await vote(id, "present", { token: b.token })).json();
    expect(re.status).toBe("community_verified");

    const detail = await (await detailGET(req(`/api/issues/${id}`), params({ id }))).json();
    const types = detail.history.map((h: { type: string }) => h.type);
    expect(types).toContain("created");
    expect(types).toContain("status_changed");
    expect(types).toContain("reopened");
    expect(JSON.stringify(detail)).not.toMatch(/officially/i);
  });
});

describe("flags", () => {
  it("allows one flag per person and auto-places under review at the threshold", async () => {
    process.env.TRUST_PROXY = "true";
    const reporter = await makeUser();
    const { id } = await makeIssue(reporter);
    const flag = (ip: string) =>
      flagPOST(req(`/api/issues/${id}/flags`, { method: "POST", json: { reason: "inaccurate" }, ip }), params({ id }));

    expect((await flag("10.0.0.1")).status).toBe(201);
    expect((await flag("10.0.0.1")).status).toBe(409);
    await flag("10.0.0.2");
    const third = await (await flag("10.0.0.3")).json();
    expect(third.underReview).toBe(true);

    const c = collections(await getDb());
    const issue = await c.issues.findOne({ _id: id });
    expect(issue!.status).toBe("under_review");
    expect(issue!.previousStatus).toBe("reported");
    expect(await c.moderationEvents.countDocuments({ issueId: id, action: "auto_under_review" })).toBe(1);
    process.env.TRUST_PROXY = "false";
  });

  it("validates flag reasons", async () => {
    const reporter = await makeUser();
    const { id } = await makeIssue(reporter);
    const res = await flagPOST(req(`/api/issues/${id}/flags`, { method: "POST", json: { reason: "nope" } }), params({ id }));
    expect(res.status).toBe(400);
  });
});

describe("rate limiting", () => {
  it("counts within a window and resets in the next one", async () => {
    const col = collections(await getDb()).rateLimits;
    const t0 = new Date("2026-01-01T00:00:10Z");
    const rule = [2, 60] as const;
    expect((await hitRateLimit(col, "k", rule, t0)).ok).toBe(true);
    expect((await hitRateLimit(col, "k", rule, t0)).ok).toBe(true);
    const third = await hitRateLimit(col, "k", rule, t0);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBe(50);
    expect((await hitRateLimit(col, "k", rule, new Date("2026-01-01T00:01:05Z"))).ok).toBe(true);
  });

  it("returns 429 with Retry-After for guests who vote too often", async () => {
    process.env.TRUST_PROXY = "true";
    const reporter = await makeUser();
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) {
      const c = collections(await getDb());
      const { id } = await makeIssue(reporter, { lat: 23.6 + i * 0.01 });
      // reset per-user report limit so we can create enough issues
      await c.rateLimits.deleteMany({});
      ids.push(id);
    }
    let last: Response | undefined;
    for (const id of ids) last = await vote(id, "present", { ip: "77.77.77.77" });
    expect(last!.status).toBe(429);
    expect(last!.headers.get("Retry-After")).toBeTruthy();
    process.env.TRUST_PROXY = "false";
  });
});
