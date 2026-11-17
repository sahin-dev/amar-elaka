import "server-only";
import { randomUUID } from "node:crypto";
import { createHmac } from "node:crypto";
import { AppError } from "@/lib/errors";
import type { CreatePollInput } from "@/lib/validation";
import type { PublicPoll } from "@/lib/public-types";
import { APP_CONFIG } from "@/config/app-config";
import { isModerator, type SessionUser } from "@/server/auth/session";
import { collections, getDb, isDuplicateKeyError } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import type { PollDoc } from "@/server/types";

function effectiveStatus(poll: PollDoc, now: Date): "open" | "closed" {
  return poll.status === "closed" || (poll.closesAt !== null && poll.closesAt <= now) ? "closed" : "open";
}

function accountKeyFor(userId: string): string {
  return createHmac("sha256", process.env.IP_HASH_SECRET || "dev-only-insecure-ip-secret").update(userId).digest("hex").slice(0, 32);
}

export async function listPolls(voterKey: string, deviceKey: string, user: SessionUser | null = null): Promise<PublicPoll[]> {
  const c = collections(await getDb());
  const now = new Date();
  const docs = await c.polls.find({}).sort({ createdAt: -1 }).limit(50).toArray();
  docs.sort((a, b) => Number(effectiveStatus(a, now) === "closed") - Number(effectiveStatus(b, now) === "closed") || b.createdAt.getTime() - a.createdAt.getTime());
  if (!docs.length) return [];
  const ids = docs.map((p) => p._id);
  const [counts, votesByViewer] = await Promise.all([
    c.pollVotes.aggregate<{ _id: { pollId: string; optionId: string }; count: number }>([
      { $match: { pollId: { $in: ids } } },
      { $group: { _id: { pollId: "$pollId", optionId: "$optionId" }, count: { $sum: 1 } } },
    ]).toArray(),
    voterKey || deviceKey || user
      ? c.pollVotes.find({ pollId: { $in: ids }, $or: [
        ...(voterKey ? [{ voterKey }] : []),
        ...(deviceKey ? [{ deviceKey }] : []),
        ...(user?.emailVerified ? [{ accountKey: accountKeyFor(user.id) }] : []),
      ] }, { projection: { pollId: 1 } }).toArray()
      : Promise.resolve([]),
  ]);
  const countMap = new Map(counts.map((x) => [`${x._id.pollId}:${x._id.optionId}`, x.count]));
  const voted = new Set(votesByViewer.map((x) => x.pollId));
  return docs.map((p) => {
    const options = p.options.map((o) => ({ ...o, votes: countMap.get(`${p._id}:${o.id}`) ?? 0 }));
    const totalVotes = options.reduce((n, o) => n + o.votes, 0);
    const hasVoted = voted.has(p._id);
    const status = effectiveStatus(p, now);
    return {
      id: p._id, topic: p.topic, question: p.question, context: p.context, sourceUrl: p.sourceUrl,
      options: options.map((o) => ({ ...o, votes: hasVoted || status === "closed" ? o.votes : 0, percent: hasVoted || status === "closed" ? (totalVotes ? Math.round(o.votes / totalVotes * 100) : 0) : 0 })),
      totalVotes: hasVoted || status === "closed" ? totalVotes : 0, status, closesAt: p.closesAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(), hasVoted,
    };
  });
}

export async function createPoll(user: SessionUser | null, input: CreatePollInput, now = new Date()): Promise<string> {
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  if (!isModerator(user)) throw new AppError("FORBIDDEN", "Moderator access required.");
  const closesAt = input.closesAt ? new Date(input.closesAt) : null;
  if (closesAt && closesAt <= now) throw new AppError("VALIDATION", "Closing time must be in the future.");
  const doc: PollDoc = {
    _id: randomUUID(), topic: input.topic, question: input.question, context: input.context,
    sourceUrl: input.sourceUrl || null,
    options: input.options.map((text) => ({ id: randomUUID(), text })),
    status: "open", voteGate: 0, closesAt, createdBy: user.id, createdAt: now, updatedAt: now,
  };
  const c = collections(await getDb());
  await c.polls.insertOne(doc);
  await c.pollEvents.insertOne({ _id: randomUUID(), pollId: doc._id, actorId: user.id, action: "created", createdAt: now });
  return doc._id;
}

export async function changePollStatus(user: SessionUser | null, pollId: string, status: "open" | "closed", now = new Date()): Promise<void> {
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  if (!isModerator(user)) throw new AppError("FORBIDDEN", "Moderator access required.");
  const c = collections(await getDb());
  const { polls } = c;
  const doc = await polls.findOne({ _id: pollId }, { projection: { closesAt: 1 } });
  if (!doc) throw new AppError("NOT_FOUND", "Poll not found.");
  const result = await polls.updateOne({ _id: pollId }, { $set: { status, updatedAt: now, ...(status === "open" && doc.closesAt && doc.closesAt <= now ? { closesAt: null } : {}) } });
  if (!result.matchedCount) throw new AppError("NOT_FOUND", "Poll not found.");
  if (result.modifiedCount) await c.pollEvents.insertOne({ _id: randomUUID(), pollId, actorId: user.id, action: status === "closed" ? "closed" : "reopened", createdAt: now });
}

export async function voteInPoll(pollId: string, user: SessionUser | null, voterKey: string, deviceKey: string, optionId: string, now = new Date()): Promise<void> {
  if (!user) throw new AppError("UNAUTHENTICATED", "Create an account and sign in to vote.");
  if (!user.emailVerified) throw new AppError("EMAIL_NOT_VERIFIED", "Verify your email before voting.");
  const c = collections(await getDb());
  const poll = await c.polls.findOne({ _id: pollId });
  if (!poll) throw new AppError("NOT_FOUND", "Poll not found.");
  if (effectiveStatus(poll, now) !== "open") throw new AppError("CONFLICT", "This poll is closed.");
  if (!poll.options.some((o) => o.id === optionId)) throw new AppError("VALIDATION", "Choose an option from this poll.");
  await enforceRateLimit(c.rateLimits, `poll-vote:${voterKey}`, APP_CONFIG.rateLimits.pollVotePerIp, now);
  const gate = await c.polls.updateOne(
    { _id: pollId, status: "open", $or: [{ closesAt: null }, { closesAt: { $gt: now } }] },
    { $inc: { voteGate: 1 } },
  );
  if (!gate.matchedCount) throw new AppError("CONFLICT", "This poll is closed.");
  try {
    const accountKey = accountKeyFor(user.id);
    await c.pollVotes.insertOne({ _id: randomUUID(), pollId, voterKey, deviceKey, accountKey, optionId, createdAt: now });
  } catch (e) {
    if (isDuplicateKeyError(e)) throw new AppError("CONFLICT", "This IP address or browser has already voted in this poll.");
    throw e;
  }
}
