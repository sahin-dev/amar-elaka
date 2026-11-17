import "server-only";
import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";
import { fromGeoPoint } from "@/lib/geo";
import { planModerationAction } from "@/lib/moderation-rules";
import type { ModerationAction } from "@/lib/validation";
import { isModerator, type SessionUser } from "@/server/auth/session";
import { collections, getDb } from "@/server/db";
import { toIssueSummary, toPublicIssue } from "@/server/dto";
import { getAreasByIds } from "@/server/services/areas";
import { recomputeStatus } from "@/server/services/community";
import { update } from "@/server/services/issues";
import { deletePhotoFiles } from "@/server/services/photos";
import type { IssueDoc, ModerationEventDoc } from "@/server/types";

/** Authorization gate for every moderation operation. */
export function requireModerator(user: SessionUser | null): asserts user is SessionUser {
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  if (!isModerator(user)) throw new AppError("FORBIDDEN", "Moderator access required.");
}

function event(e: Omit<ModerationEventDoc, "_id" | "createdAt">, now = new Date()): ModerationEventDoc {
  return { _id: randomUUID(), createdAt: now, ...e };
}

export async function getModerationQueues(user: SessionUser | null) {
  requireModerator(user);
  const c = collections(await getDb());
  const lim = 50;
  const [pending, flagged, duplicates, review, photos] = await Promise.all([
    c.issues.find({ moderationState: "pending" }).sort({ createdAt: 1 }).limit(lim).toArray(),
    c.issues
      .find({ "counts.openFlags": { $gt: 0 }, moderationState: { $in: ["visible", "pending", "merged"] } })
      .sort({ "counts.openFlags": -1, updatedAt: 1 })
      .limit(lim)
      .toArray(),
    c.issues.find({ "possibleDuplicateOf.0": { $exists: true }, moderationState: { $in: ["visible", "pending"] } }).sort({ createdAt: 1 }).limit(lim).toArray(),
    c.issues.find({ status: "under_review", moderationState: "visible" }).sort({ updatedAt: 1 }).limit(lim).toArray(),
    c.issuePhotos.find({ moderationState: "pending" }).sort({ createdAt: 1 }).limit(lim).toArray(),
  ]);
  const all = [...pending, ...flagged, ...duplicates, ...review];
  const areas = await getAreasByIds(all.map((i) => i.areaId));
  const row = (i: IssueDoc) => ({
    ...toIssueSummary(i, i.areaId ? areas.get(i.areaId) : null),
    moderationState: i.moderationState,
    openFlags: i.counts.openFlags,
    duplicateCount: i.possibleDuplicateOf.length,
  });
  return {
    pending: pending.map(row),
    flagged: flagged.map(row),
    duplicates: duplicates.map(row),
    review: review.map(row),
    photos: photos.map((p) => ({ id: p._id, issueId: p.issueId, createdAt: p.createdAt.toISOString(), width: p.width, height: p.height })),
  };
}

export async function getModerationIssue(user: SessionUser | null, id: string) {
  requireModerator(user);
  const c = collections(await getDb());
  const doc = await c.issues.findOne({ _id: id });
  if (!doc) return null;
  const [priv, exact, photos, flags, events, votes, dupDocs] = await Promise.all([
    c.issuePrivate.findOne({ _id: id }),
    c.issueExactLocations.findOne({ _id: id }),
    c.issuePhotos.find({ issueId: id }).sort({ createdAt: 1 }).toArray(),
    c.issueFlags.find({ issueId: id }).sort({ createdAt: -1 }).limit(100).toArray(),
    c.moderationEvents.find({ issueId: id }).sort({ createdAt: -1 }).limit(100).toArray(),
    c.issueVotes
      .aggregate<{ _id: { round: number; kind: string }; n: number }>([
        { $match: { issueId: id } },
        { $group: { _id: { round: "$round", kind: "$kind" }, n: { $sum: 1 } } },
        { $sort: { "_id.round": -1 } },
      ])
      .toArray(),
    doc.possibleDuplicateOf.length ? c.issues.find({ _id: { $in: doc.possibleDuplicateOf } }).toArray() : Promise.resolve([] as IssueDoc[]),
  ]);
  const areas = await getAreasByIds([doc.areaId, ...dupDocs.map((d) => d.areaId)]);
  return {
    issue: toPublicIssue(doc, doc.areaId ? areas.get(doc.areaId) : null),
    moderationState: doc.moderationState,
    round: doc.round,
    openFlags: doc.counts.openFlags,
    previousStatus: doc.previousStatus,
    private: {
      // Opaque reference only; moderators do not need the reporter's email to moderate content.
      reporterRef: priv?.reporterId ? `${priv.reporterId.slice(0, 8)}…` : null,
      reporterIpRef: priv?.reporterIpKey ? `${priv.reporterIpKey.slice(0, 8)}…` : null,
      exactLocation: exact ? fromGeoPoint(exact.location) : null,
      exactLocationExpiresAt: exact?.expiresAt.toISOString() ?? null,
    },
    photos: photos.map((p) => ({ id: p._id, state: p.moderationState, createdAt: p.createdAt.toISOString(), width: p.width, height: p.height })),
    flags: flags.map((f) => ({ id: f._id, reason: f.reason, details: f.details, state: f.state, createdAt: f.createdAt.toISOString(), byAccount: !!f.userId })),
    events: events.map((e) => ({
      id: e._id,
      action: e.action,
      from: e.from,
      to: e.to,
      note: e.note,
      actor: e.actorId === "system" ? "system" : `${e.actorId.slice(0, 8)}…`,
      createdAt: e.createdAt.toISOString(),
    })),
    votes: votes.map((v) => ({ round: v._id.round, kind: v._id.kind, n: v.n })),
    duplicates: dupDocs.map((d) => ({ ...toIssueSummary(d, d.areaId ? areas.get(d.areaId) : null), moderationState: d.moderationState })),
  };
}

export async function applyModerationAction(
  user: SessionUser | null,
  issueId: string,
  input: { action: ModerationAction; note: string; targetIssueId?: string },
  now = new Date(),
): Promise<{ status: IssueDoc["status"]; moderationState: IssueDoc["moderationState"] }> {
  requireModerator(user);
  const c = collections(await getDb());
  const issue = await c.issues.findOne({ _id: issueId });
  if (!issue) throw new AppError("NOT_FOUND", "Report not found.");

  const planned = planModerationAction(
    { status: issue.status, moderationState: issue.moderationState, previousStatus: issue.previousStatus, openFlags: issue.counts.openFlags },
    input.action,
  );
  if (!planned.ok) throw new AppError("CONFLICT", planned.reason);
  const plan = planned.plan;

  let target: IssueDoc | null = null;
  if (input.action === "merge") {
    if (!input.targetIssueId || input.targetIssueId === issueId) {
      throw new AppError("VALIDATION", "Choose a different report to merge into.", { fields: { targetIssueId: "Invalid target" } });
    }
    target = await c.issues.findOne({ _id: input.targetIssueId });
    if (!target || target.moderationState !== "visible") {
      throw new AppError("VALIDATION", "The target report must exist and be public.", { fields: { targetIssueId: "Target not found" } });
    }
  }

  const set: Partial<IssueDoc> = { ...plan.set, updatedAt: now };
  if (target) set.mergedInto = target._id;
  if (plan.flags !== "keep") set.counts = { ...issue.counts, openFlags: 0 };

  // Optimistic lock on the fields the plan was computed from.
  const res = await c.issues.updateOne(
    { _id: issueId, status: issue.status, moderationState: issue.moderationState },
    { $set: set },
  );
  if (res.modifiedCount === 0) throw new AppError("CONFLICT", "This report changed while you were reviewing it. Reload and try again.");

  if (plan.flags !== "keep") {
    await c.issueFlags.updateMany(
      { issueId, state: "open" },
      { $set: { state: plan.flags === "dismiss" ? "dismissed" : "actioned", resolvedAt: now } },
    );
  }

  if (plan.publicUpdate) {
    const toStatus = plan.set.status ?? null;
    await c.issueUpdates.insertOne(update(issueId, plan.publicUpdate, "moderator", issue.status, toStatus, now));
  }
  if (target) {
    await c.issueUpdates.insertOne(update(target._id, "merged_from", "moderator", null, null, now));
    await c.issues.updateOne({ _id: target._id }, { $set: { lastActivityAt: now, updatedAt: now } });
  }

  await c.moderationEvents.insertOne(
    event(
      {
        issueId,
        targetType: "issue",
        targetId: issueId,
        action: input.action,
        actorId: user.id,
        from: plan.from,
        to: target ? `merged:${target._id}` : plan.to,
        note: input.note,
      },
      now,
    ),
  );

  const after = plan.recompute ? await recomputeStatus(c, issueId, now) : await c.issues.findOne({ _id: issueId });
  return { status: after!.status, moderationState: after!.moderationState };
}

export async function moderatePhoto(
  user: SessionUser | null,
  photoId: string,
  decision: "approve" | "reject",
  note: string,
  now = new Date(),
): Promise<void> {
  requireModerator(user);
  const db = await getDb();
  const c = collections(db);
  const photo = await c.issuePhotos.findOne({ _id: photoId });
  if (!photo) throw new AppError("NOT_FOUND", "Photo not found.");
  if (photo.moderationState !== "pending") throw new AppError("CONFLICT", "This photo has already been reviewed.");

  const state = decision === "approve" ? "approved" : "rejected";
  const res = await c.issuePhotos.updateOne({ _id: photoId, moderationState: "pending" }, { $set: { moderationState: state, reviewedAt: now } });
  if (res.modifiedCount === 0) throw new AppError("CONFLICT", "This photo has already been reviewed.");

  const stillPending = await c.issuePhotos.countDocuments({ issueId: photo.issueId, moderationState: "pending" });
  if (decision === "approve") {
    const r = await c.issues.updateOne(
      { _id: photo.issueId, publicPhotoId: null },
      { $set: { publicPhotoId: photoId, photoPending: stillPending > 0, updatedAt: now } },
    );
    if (r.modifiedCount) await c.issueUpdates.insertOne(update(photo.issueId, "photo_added", "moderator", null, null, now));
  } else {
    // Rejected images are deleted rather than retained.
    await deletePhotoFiles(db, photo);
    await c.issues.updateOne({ _id: photo.issueId }, { $set: { photoPending: stillPending > 0, updatedAt: now } });
  }

  await c.moderationEvents.insertOne(
    event(
      {
        issueId: photo.issueId,
        targetType: "photo",
        targetId: photoId,
        action: decision === "approve" ? "photo_approve" : "photo_reject",
        actorId: user.id,
        from: "pending",
        to: state,
        note,
      },
      now,
    ),
  );
}

export async function listAuditLog(user: SessionUser | null, limit = 50) {
  requireModerator(user);
  const c = collections(await getDb());
  const events = await c.moderationEvents.find({}).sort({ createdAt: -1 }).limit(Math.min(limit, 200)).toArray();
  return events.map((e) => ({
    id: e._id,
    issueId: e.issueId,
    targetType: e.targetType,
    action: e.action,
    from: e.from,
    to: e.to,
    note: e.note,
    actor: e.actorId === "system" ? "system" : `${e.actorId.slice(0, 8)}…`,
    createdAt: e.createdAt.toISOString(),
  }));
}
