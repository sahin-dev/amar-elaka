import "server-only";
import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import { AppError } from "@/lib/errors";

import type {
  AreaDoc,
  IssueDoc,
  IssueExactLocationDoc,
  IssueFlagDoc,
  IssuePhotoDoc,
  IssuePrivateDoc,
  IssueUpdateDoc,
  IssueVoteDoc,
  ModerationEventDoc,
  ProfileDoc,
  PollDoc,
  PollVoteDoc,
  PollEventDoc,
  RateLimitDoc,
  SessionDoc,
} from "./types";

/**
 * One MongoClient per process. In dev, Next.js hot reload would otherwise
 * create a new pool on every edit and exhaust Atlas M0's connection limit.
 */
const g = globalThis as unknown as { __aeMongo?: { uri: string; promise: Promise<MongoClient> } };

export function isDbConfigured(): boolean {
  return !!process.env.MONGODB_URI;
}

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new AppError("UNAVAILABLE", "The database is not configured. Set MONGODB_URI (see README).");
  }
  if (!g.__aeMongo || g.__aeMongo.uri !== uri) {

    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      appName: "amarelaka",
    });
    g.__aeMongo = { uri, promise: client.connect() };
    // Allow a retry on the next request if the first connection fails.
    g.__aeMongo.promise.catch(() => {
      if (g.__aeMongo?.uri === uri) g.__aeMongo = undefined;
    });
  }
  return g.__aeMongo.promise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || "amarelaka");
}

/** Typed collection accessors. The only place collection names appear. */
export function collections(db: Db) {
  const c = <T extends Document>(name: string) => db.collection<T>(name) as Collection<T>;
  return {
    areas: c<AreaDoc>("areas"),
    profiles: c<ProfileDoc>("profiles"),
    polls: c<PollDoc>("polls"),
    pollVotes: c<PollVoteDoc>("poll_votes"),
    pollEvents: c<PollEventDoc>("poll_events"),
    sessions: c<SessionDoc>("sessions"),
    issues: c<IssueDoc>("issues"),
    issuePrivate: c<IssuePrivateDoc>("issue_private"),
    issueExactLocations: c<IssueExactLocationDoc>("issue_exact_locations"),
    issuePhotos: c<IssuePhotoDoc>("issue_photos"),
    issueUpdates: c<IssueUpdateDoc>("issue_updates"),
    issueVotes: c<IssueVoteDoc>("issue_votes"),
    issueFlags: c<IssueFlagDoc>("issue_flags"),
    moderationEvents: c<ModerationEventDoc>("moderation_events"),
    rateLimits: c<RateLimitDoc>("rate_limits"),
  };
}

export type Collections = ReturnType<typeof collections>;

export async function getCollections(): Promise<Collections> {
  return collections(await getDb());
}

/** Duplicate-key error (unique index violation). */
export function isDuplicateKeyError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === 11000;
}
