import { beforeEach, describe, expect, it } from "vitest";
import { GET as queueGET } from "@/app/api/moderation/queue/route";
import { GET as modIssueGET, POST as modIssuePOST } from "@/app/api/moderation/issues/[id]/route";
import { POST as photoPOST } from "@/app/api/moderation/photos/[id]/route";
import { GET as detailGET } from "@/app/api/issues/[id]/route";
import { collections, getDb } from "@/server/db";
import { makeIssue, makeUser, params, req, resetDb } from "../helpers/fixtures";

beforeEach(resetDb);

const act = (id: string, body: object, token?: string) =>
  modIssuePOST(req(`/api/moderation/issues/${id}`, { method: "POST", json: body, token }), params({ id }));

describe("moderation permissions", () => {
  it("rejects anonymous users and residents", async () => {
    const resident = await makeUser();
    const { id } = await makeIssue(resident);
    expect((await queueGET(req("/api/moderation/queue"))).status).toBe(401);
    expect((await queueGET(req("/api/moderation/queue", { token: resident.token }))).status).toBe(403);
    expect((await modIssueGET(req(`/api/moderation/issues/${id}`, { token: resident.token }), params({ id }))).status).toBe(403);
    expect((await act(id, { action: "hide" }, resident.token)).status).toBe(403);
    expect((await act(id, { action: "hide" })).status).toBe(401);
    const issue = await collections(await getDb()).issues.findOne({ _id: id });
    expect(issue!.moderationState).toBe("visible");
  });

  it("rejects photo moderation by non-moderators", async () => {
    const resident = await makeUser();
    const fakeId = "11111111-1111-4111-8111-111111111111";
    const res = await photoPOST(req(`/api/moderation/photos/${fakeId}`, { method: "POST", json: { decision: "approve" }, token: resident.token }), params({ id: fakeId }));
    expect(res.status).toBe(403);
  });
});

describe("moderation actions", () => {
  it("hides a report, records an audit event with the internal note, and keeps the note private", async () => {
    const resident = await makeUser();
    const mod = await makeUser("moderator");
    const { id } = await makeIssue(resident);
    const res = await act(id, { action: "hide", note: "contains a face" }, mod.token);
    expect(res.status).toBe(200);
    expect((await res.json()).moderationState).toBe("hidden");

    const events = await collections(await getDb()).moderationEvents.find({ issueId: id }).toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "hide", actorId: mod.id, from: "visible", to: "hidden", note: "contains a face" });

    // Public detail is gone; the reporter sees it but never the internal note.
    expect((await detailGET(req(`/api/issues/${id}`), params({ id }))).status).toBe(404);
    const own = await (await detailGET(req(`/api/issues/${id}`, { token: resident.token }), params({ id }))).text();
    expect(own).not.toContain("contains a face");
  });

  it("archives and restores to the previous status", async () => {
    const resident = await makeUser();
    const mod = await makeUser("admin");
    const { id } = await makeIssue(resident);
    expect((await (await act(id, { action: "archive" }, mod.token)).json()).status).toBe("archived");
    expect((await act(id, { action: "archive" }, mod.token)).status).toBe(409);
    expect((await (await act(id, { action: "restore" }, mod.token)).json()).status).toBe("reported");
  });

  it("merges into a public target and shows a merged notice", async () => {
    const resident = await makeUser();
    const mod = await makeUser("moderator");
    const a = await makeIssue(resident);
    const b = await makeIssue(resident, { lat: 23.81 });
    expect((await act(a.id, { action: "merge", targetIssueId: a.id }, mod.token)).status).toBe(400);
    const res = await act(a.id, { action: "merge", targetIssueId: b.id }, mod.token);
    expect(res.status).toBe(200);
    const detail = await (await detailGET(req(`/api/issues/${a.id}`), params({ id: a.id }))).json();
    expect(detail.issue.mergedInto).toBe(b.id);
  });

  it("moderator detail exposes the exact location only to moderators", async () => {
    const resident = await makeUser();
    const mod = await makeUser("moderator");
    const { id } = await makeIssue(resident);
    const data = await (await modIssueGET(req(`/api/moderation/issues/${id}`, { token: mod.token }), params({ id }))).json();
    expect(data.private.exactLocation).toEqual({ lat: 23.80123, lng: 90.36789 });
    // Even moderators get an opaque reporter reference, not the email.
    expect(JSON.stringify(data)).not.toContain(resident.email);
  });

  it("validates action input", async () => {
    const mod = await makeUser("moderator");
    const resident = await makeUser();
    const { id } = await makeIssue(resident);
    expect((await act(id, { action: "delete_everything" }, mod.token)).status).toBe(400);
    expect((await act(id, { action: "merge" }, mod.token)).status).toBe(400);
  });
});
