import { beforeEach, describe, expect, it } from "vitest";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { DELETE as accountDELETE, GET as accountGET, PATCH as accountPATCH } from "@/app/api/account/route";
import { GET as exportGET } from "@/app/api/account/export/route";
import { POST as votePOST } from "@/app/api/issues/[id]/votes/route";
import { GET as detailGET } from "@/app/api/issues/[id]/route";
import { collections, getDb } from "@/server/db";
import { makeIssue, makeUser, params, req, resetDb } from "../helpers/fixtures";

beforeEach(resetDb);

describe("authentication", () => {
  it("signs up, sets an httpOnly session cookie, and rejects duplicate emails", async () => {
    const body = { email: "New@Example.test", password: "a long password", acceptGuidelines: true };
    const res = await signupPOST(req("/api/auth/signup", { method: "POST", json: body }));
    expect(res.status).toBe(201);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/ae_session=/);
    expect(cookie.toLowerCase()).toContain("httponly");
    const profile = await collections(await getDb()).profiles.findOne({ email: "new@example.test" });
    expect(profile!.passwordHash).toMatch(/^scrypt\$/);
    expect(profile!.role).toBe("resident");

    const dup = await signupPOST(req("/api/auth/signup", { method: "POST", json: body }));
    expect(dup.status).toBe(409);
  });

  it("cannot self-assign a moderator role at signup", async () => {
    const body = { email: "sneaky@example.test", password: "a long password", acceptGuidelines: true, role: "admin" };
    await signupPOST(req("/api/auth/signup", { method: "POST", json: body }));
    const profile = await collections(await getDb()).profiles.findOne({ email: "sneaky@example.test" });
    expect(profile!.role).toBe("resident");
  });

  it("gives the same error for unknown email and wrong password", async () => {
    const u = await makeUser();
    const a = await loginPOST(req("/api/auth/login", { method: "POST", json: { email: u.email, password: "wrong password" } }));
    const b = await loginPOST(req("/api/auth/login", { method: "POST", json: { email: "nobody@example.test", password: "wrong password" } }));
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect((await a.json()).error.message).toBe((await b.json()).error.message);
    const ok = await loginPOST(req("/api/auth/login", { method: "POST", json: { email: u.email, password: u.password } }));
    expect(ok.status).toBe(200);
  });
});

describe("account privacy", () => {
  it("PATCH only updates the caller's own profile, even if another id is supplied", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const res = await accountPATCH(req("/api/account", { method: "PATCH", token: a.token, json: { displayName: "Changed", id: b.id, userId: b.id, role: "admin" } }));
    expect(res.status).toBe(200);
    const c = collections(await getDb());
    expect((await c.profiles.findOne({ _id: a.id }))!.displayName).toBe("Changed");
    expect((await c.profiles.findOne({ _id: a.id }))!.role).toBe("resident");
    expect((await c.profiles.findOne({ _id: b.id }))!.displayName).not.toBe("Changed");
  });

  it("requires auth for account endpoints", async () => {
    expect((await accountGET(req("/api/account"))).status).toBe(401);
    expect((await exportGET(req("/api/account/export"))).status).toBe(401);
    expect((await accountPATCH(req("/api/account", { method: "PATCH", json: { displayName: "x" } }))).status).toBe(401);
  });

  it("export contains own data and never the password hash", async () => {
    const a = await makeUser();
    await makeIssue(a);
    const text = await (await exportGET(req("/api/account/export", { token: a.token }))).text();
    expect(text).toContain(a.email);
    expect(text).not.toContain("passwordHash");
    expect(JSON.parse(text).reports).toHaveLength(1);
  });

  it("deletes the account, unlinks votes and optionally removes reports", async () => {
    const a = await makeUser();
    const other = await makeUser();
    const { id: otherIssue } = await makeIssue(other);
    const { id: myIssue } = await makeIssue(a, { lat: 23.82 });
    await votePOST(req(`/api/issues/${otherIssue}/votes`, { method: "POST", json: { kind: "present" }, token: a.token }), params({ id: otherIssue }));

    const wrong = await accountDELETE(req("/api/account", { method: "DELETE", token: a.token, json: { password: "nope", removeReports: true } }));
    expect(wrong.status).toBe(401);

    const res = await accountDELETE(req("/api/account", { method: "DELETE", token: a.token, json: { password: a.password, removeReports: true } }));
    expect(res.status).toBe(200);

    const c = collections(await getDb());
    expect(await c.profiles.findOne({ _id: a.id })).toBeNull();
    expect(await c.sessions.countDocuments({ userId: a.id })).toBe(0);
    expect(await c.issueVotes.countDocuments({ userId: a.id })).toBe(0);
    const votes = await c.issueVotes.find({ issueId: otherIssue }).toArray();
    expect(votes).toHaveLength(1);
    expect(votes[0]!.voterKey.startsWith("d:")).toBe(true);
    expect((await c.issuePrivate.findOne({ _id: myIssue }))!.reporterId).toBeNull();
    expect((await c.issues.findOne({ _id: myIssue }))!.moderationState).toBe("removed");
    expect(await c.issueExactLocations.findOne({ _id: myIssue })).toBeNull();
    // Counts on the other issue are preserved.
    expect((await c.issues.findOne({ _id: otherIssue }))!.counts.present).toBe(1);
    expect((await detailGET(req(`/api/issues/${myIssue}`), params({ id: myIssue }))).status).toBe(404);
  });
});

describe("API error handling", () => {
  it("returns consistent error bodies without internals", async () => {
    const bad = await detailGET(req("/api/issues/not-a-uuid"), params({ id: "not-a-uuid" }));
    expect(bad.status).toBe(400);
    const body = await bad.json();
    expect(body.error).toMatchObject({ code: "VALIDATION" });

    const missing = "22222222-2222-4222-8222-222222222222";
    const nf = await detailGET(req(`/api/issues/${missing}`), params({ id: missing }));
    expect(nf.status).toBe(404);
    expect((await nf.json()).error.code).toBe("NOT_FOUND");
  });

  it("rejects malformed JSON and missing Origin on mutations", async () => {
    const u = await makeUser();
    const malformed = await accountPATCH(
      req("/api/account", { method: "PATCH", token: u.token, body: "{not json", headers: { "content-type": "application/json" } }),
    );
    expect(malformed.status).toBe(400);
    const noOrigin = await accountPATCH(req("/api/account", { method: "PATCH", token: u.token, json: { displayName: "x" }, origin: null }));
    expect(noOrigin.status).toBe(403);
  });
});
