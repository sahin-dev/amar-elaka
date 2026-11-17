import { beforeEach, describe, expect, it } from "vitest";
import { GET as listGET, POST as createPOST } from "@/app/api/issues/route";
import { GET as detailGET } from "@/app/api/issues/[id]/route";
import { GET as markersGET } from "@/app/api/issues/markers/route";
import { collections, getDb } from "@/server/db";
import { distanceMeters, fromGeoPoint } from "@/lib/geo";
import { baseReport, makeIssue, makeUser, params, req, resetDb, TEST_AREA } from "../helpers/fixtures";

function reportForm(over: Record<string, string> = {}) {
  const f = new FormData();
  const r = baseReport();
  for (const [k, v] of Object.entries({ category: r.category, title: r.title, description: r.description, lat: String(r.lat), lng: String(r.lng), ...over })) {
    f.set(k, v);
  }
  return f;
}

beforeEach(resetDb);

describe("creating reports", () => {
  it("requires sign-in", async () => {
    const res = await createPOST(req("/api/issues", { method: "POST", body: reportForm() }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects invalid input with field errors", async () => {
    const u = await makeUser();
    const res = await createPOST(req("/api/issues", { method: "POST", token: u.token, body: reportForm({ title: "x", lat: "51.5" }) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.fields.title).toBeTruthy();
    expect(body.error.fields.lat).toBeTruthy();
  });

  it("creates an issue with an approximate public location and protected exact location", async () => {
    const u = await makeUser();
    const res = await createPOST(req("/api/issues", { method: "POST", token: u.token, body: reportForm() }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const c = collections(await getDb());
    const issue = await c.issues.findOne({ _id: id });
    const exact = await c.issueExactLocations.findOne({ _id: id });
    const priv = await c.issuePrivate.findOne({ _id: id });
    expect(issue!.areaId).toBe(TEST_AREA._id);
    expect(fromGeoPoint(exact!.location)).toEqual({ lat: 23.80123, lng: 90.36789 });
    expect(fromGeoPoint(issue!.location)).not.toEqual({ lat: 23.80123, lng: 90.36789 });
    expect(distanceMeters(fromGeoPoint(issue!.location), fromGeoPoint(exact!.location))).toBeLessThan(125);
    expect(priv!.reporterId).toBe(u.id);
    expect(exact!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("blocks cross-site submissions", async () => {
    const u = await makeUser();
    const res = await createPOST(req("/api/issues", { method: "POST", token: u.token, body: reportForm(), origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("BAD_ORIGIN");
  });

  it("silently refuses honeypot submissions", async () => {
    const u = await makeUser();
    const res = await createPOST(req("/api/issues", { method: "POST", token: u.token, body: reportForm({ website: "http://x" }) }));
    expect(res.status).toBe(400);
  });

  it("warns about likely duplicates and allows an explicit override", async () => {
    const u = await makeUser();
    const other = await makeUser();
    await makeIssue(u);
    const first = await createPOST(req("/api/issues", { method: "POST", token: other.token, body: reportForm() }));
    expect(first.status).toBe(409);
    const body = await first.json();
    expect(body.error.details.duplicates).toHaveLength(1);

    const second = await createPOST(req("/api/issues", { method: "POST", token: other.token, body: reportForm({ acknowledgeDuplicate: "true" }) }));
    expect(second.status).toBe(201);
    const { id } = await second.json();
    const doc = await collections(await getDb()).issues.findOne({ _id: id });
    expect(doc!.possibleDuplicateOf).toHaveLength(1);
  });

  it("rate limits report creation per account", async () => {
    const u = await makeUser();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      // Spread reports apart so duplicate detection doesn't interfere.
      const r = await createPOST(
        req("/api/issues", { method: "POST", token: u.token, body: reportForm({ lat: String(23.70 + i * 0.02), acknowledgeDuplicate: "true" }) }),
      );
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe("public reads never expose private data", () => {
  it("detail and list responses omit reporter identity and exact coordinates", async () => {
    const u = await makeUser();
    const { id } = await makeIssue(u);
    const detail = await detailGET(req(`/api/issues/${id}`), params({ id }));
    const list = await listGET(req("/api/issues?summary=1"));
    const markers = await markersGET(req("/api/issues/markers"));
    for (const res of [detail, list, markers]) {
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).not.toContain(u.id);
      expect(text).not.toContain(u.email);
      expect(text).not.toContain("reporterId");
      expect(text).not.toContain("moderationState");
      expect(text).not.toContain("23.80123");
      expect(text).not.toContain("90.36789");
    }
  });

  it("hidden and pending reports are not visible to the public or other residents", async () => {
    const u = await makeUser();
    const stranger = await makeUser();
    const mod = await makeUser("moderator");
    const { id } = await makeIssue(u);
    await collections(await getDb()).issues.updateOne({ _id: id }, { $set: { moderationState: "hidden" } });

    expect((await detailGET(req(`/api/issues/${id}`), params({ id }))).status).toBe(404);
    expect((await detailGET(req(`/api/issues/${id}`, { token: stranger.token }), params({ id }))).status).toBe(404);
    // The reporter and moderators can still see it.
    expect((await detailGET(req(`/api/issues/${id}`, { token: u.token }), params({ id }))).status).toBe(200);
    expect((await detailGET(req(`/api/issues/${id}`, { token: mod.token }), params({ id }))).status).toBe(200);

    const list = await (await listGET(req("/api/issues"))).json();
    expect(list.items).toHaveLength(0);
  });

  it("filters by bounds and category, and paginates", async () => {
    const u = await makeUser();
    for (let i = 0; i < 3; i++) await makeIssue(u, { lat: 23.8 + i * 0.01 });
    await makeIssue(u, { category: "garbage", lat: 22.35, lng: 91.8 });

    const inDhaka = await (await listGET(req("/api/issues?bbox=90.3,23.7,90.5,23.9&limit=2"))).json();
    expect(inDhaka.items).toHaveLength(2);
    expect(inDhaka.hasMore).toBe(true);
    const page2 = await (await listGET(req("/api/issues?bbox=90.3,23.7,90.5,23.9&limit=2&page=2"))).json();
    expect(page2.items).toHaveLength(1);

    const garbage = await (await listGET(req("/api/issues?category=garbage"))).json();
    expect(garbage.items).toHaveLength(1);
    expect(garbage.items[0].category).toBe("garbage");

    const bad = await listGET(req("/api/issues?bbox=nonsense"));
    expect(bad.status).toBe(400);
  });
});
