import "server-only";
import { randomUUID } from "node:crypto";
import { APP_CONFIG, type IssueStatus } from "@/config/app-config";
import { AppError } from "@/lib/errors";
import { computeStatus } from "@/lib/status";
import type { FlagReason } from "@/lib/validation";
import type { SessionUser } from "@/server/auth/session";
import { collections, getDb, isDuplicateKeyError, type Collections } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import { update } from "@/server/services/issues";
import type { IssueDoc } from "@/server/types";

export interface VoteResult {
  status: IssueStatus;
  presentCount: number;
  fixedCount: number;
}

function voterKeyFor(user: SessionUser | null, guestKey: string): string {
  return user ? `u:${user.id}` : `g:${guestKey}`;
}

async function loadVotableIssue(c: Collections, issueId: string): Promise<IssueDoc> {
  const issue = await c.issues.findOne({ _id: issueId });
  if (!issue || issue.moderationState !== "visible") throw new AppError("NOT_FOUND", "Report not found.");
  if (issue.status === "archived") throw new AppError("CONFLICT", "This report is archived.");
  return issue;
}

/**
 * Re-run the community status machine for an issue's current round and
 * persist any change. Uses the round + status as an optimistic lock so two
 * concurrent votes cannot both advance the round.
 */
export async function recomputeStatus(c: Collections, issueId: string, now = new Date()): Promise<IssueDoc | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const issue = await c.issues.findOne({ _id: issueId });
    if (!issue) return null;
    const votes = await c.issueVotes.find({ issueId, round: issue.round }).toArray();
    const result = computeStatus(
      {
        status: issue.status,
        votes: votes.map((v) => ({ kind: v.kind, voterKey: v.voterKey, isAccount: v.voterKey.startsWith("u:"), createdAt: v.createdAt })),
        now,
      },
      APP_CONFIG.community,
    );
    if (result.status === issue.status) return issue;

    const set: Partial<IssueDoc> = { status: result.status, updatedAt: now, lastActivityAt: now };
    if (result.status === "community_resolved") set.resolvedAt = now;
    if (issue.status === "community_resolved") set.resolvedAt = null;
    const res = await c.issues.updateOne(
      { _id: issueId, round: issue.round, status: issue.status },
      { $set: set, ...(result.advanceRound ? { $inc: { round: 1 } } : {}) },
    );
    if (res.modifiedCount === 0) continue; // lost a race; re-read and retry
    const reopened = issue.status === "community_resolved" && result.status !== "community_resolved";
    await c.issueUpdates.insertOne(
      update(issueId, reopened ? "reopened" : "status_changed", "community", issue.status, result.status, now),
    );
    return { ...issue, ...set, round: issue.round + (result.advanceRound ? 1 : 0) } as IssueDoc;
  }
  return c.issues.findOne({ _id: issueId });
}

export async function castVote(
  issueId: string,
  kind: "present" | "fixed",
  ctx: { user: SessionUser | null; guestKey: string; now?: Date },
): Promise<VoteResult> {
  const now = ctx.now ?? new Date();
  if (!ctx.user) throw new AppError("UNAUTHENTICATED", "Create an account and sign in to vote.");
  if (!ctx.user.emailVerified) throw new AppError("EMAIL_NOT_VERIFIED", "Verify your email before voting.");
  const c = collections(await getDb());
  const issue = await loadVotableIssue(c, issueId);

  if (ctx.user && kind === "present") {
    const priv = await c.issuePrivate.findOne({ _id: issueId }, { projection: { reporterId: 1 } });
    if (priv?.reporterId === ctx.user.id) throw new AppError("FORBIDDEN", "You can't confirm your own report.");
  }

  const RL = APP_CONFIG.rateLimits;
  if (ctx.user) await enforceRateLimit(c.rateLimits, `vote:u:${ctx.user.id}`, RL.votePerUser, now);
  else await enforceRateLimit(c.rateLimits, `vote:g:${ctx.guestKey}`, RL.votePerGuest, now);

  try {
    await c.issueVotes.insertOne({
      _id: randomUUID(),
      issueId,
      round: issue.round,
      voterKey: voterKeyFor(ctx.user, ctx.guestKey),
      userId: ctx.user?.id ?? null,
      kind,
      createdAt: now,
    });
  } catch (e) {
    if (isDuplicateKeyError(e)) throw new AppError("CONFLICT", "You have already responded to this report.");
    throw e;
  }

  await c.issues.updateOne(
    { _id: issueId },
    {
      $inc: kind === "present" ? { "counts.present": 1 } : { "counts.fixed": 1 },
      $set: { lastActivityAt: now, updatedAt: now, ...(kind === "present" ? { lastConfirmedAt: now } : {}) },
    },
  );
  await c.issueUpdates.insertOne(update(issueId, kind === "present" ? "confirmed_present" : "reported_fixed", "community", null, null, now));

  const after = (await recomputeStatus(c, issueId, now)) ?? issue;
  return { status: after.status, presentCount: after.counts.present, fixedCount: after.counts.fixed };
}

export async function createFlag(
  issueId: string,
  reason: FlagReason,
  details: string,
  ctx: { user: SessionUser | null; guestKey: string; now?: Date },
): Promise<{ underReview: boolean }> {
  const now = ctx.now ?? new Date();
  const c = collections(await getDb());
  const issue = await c.issues.findOne({ _id: issueId });
  // Flags are allowed on any publicly reachable report (including merged).
  if (!issue || (issue.moderationState !== "visible" && issue.moderationState !== "merged")) {
    throw new AppError("NOT_FOUND", "Report not found.");
  }

  const RL = APP_CONFIG.rateLimits;
  if (ctx.user) await enforceRateLimit(c.rateLimits, `flag:u:${ctx.user.id}`, RL.flagPerUser, now);
  else await enforceRateLimit(c.rateLimits, `flag:g:${ctx.guestKey}`, RL.flagPerGuest, now);

  try {
    await c.issueFlags.insertOne({
      _id: randomUUID(),
      issueId,
      reason,
      details,
      flaggerKey: voterKeyFor(ctx.user, ctx.guestKey),
      userId: ctx.user?.id ?? null,
      state: "open",
      createdAt: now,
      resolvedAt: null,
    });
  } catch (e) {
    if (isDuplicateKeyError(e)) throw new AppError("CONFLICT", "You have already flagged this report.");
    throw e;
  }

  const updated = await c.issues.findOneAndUpdate(
    { _id: issueId },
    { $inc: { "counts.openFlags": 1 }, $set: { updatedAt: now } },
    { returnDocument: "after" },
  );

  // Enough independent flags: put the report under review automatically.
  if (
    updated &&
    updated.counts.openFlags >= APP_CONFIG.community.flagReviewThreshold &&
    updated.status !== "under_review" &&
    updated.status !== "archived" &&
    updated.moderationState === "visible"
  ) {
    const res = await c.issues.updateOne(
      { _id: issueId, status: updated.status },
      { $set: { status: "under_review", previousStatus: updated.status, updatedAt: now } },
    );
    if (res.modifiedCount) {
      await c.issueUpdates.insertOne(update(issueId, "under_review", "system", updated.status, "under_review", now));
      await c.moderationEvents.insertOne({
        _id: randomUUID(),
        issueId,
        targetType: "issue",
        targetId: issueId,
        action: "auto_under_review",
        actorId: "system",
        from: updated.status,
        to: "under_review",
        note: `Automatically placed under review after ${updated.counts.openFlags} open flags.`,
        createdAt: now,
      });
      return { underReview: true };
    }
  }
  return { underReview: false };
}
