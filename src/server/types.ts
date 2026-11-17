import type { ObjectId } from "mongodb";
import type { CategoryId, IssueStatus, ModerationState } from "@/config/app-config";
import type { GeoPoint } from "@/lib/geo";
import type { FlagReason, ModerationAction } from "@/lib/validation";
import type { Locale } from "@/i18n";

/**
 * MongoDB document shapes. All primary keys are UUID strings
 * (crypto.randomUUID) except sessions/rate limits, which use hashed keys.
 *
 * PUBLIC vs PRIVATE: `issues` contains only data that may be shown publicly
 * (approximate location, no reporter). Everything identifying lives in
 * `issue_private` / `issue_exact_locations` and is only read by moderator
 * code paths. See docs/DATABASE.md.
 */

export type Role = "resident" | "moderator" | "admin";

export interface Polygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface AreaDoc {
  _id: string;
  slug: string;
  name: { en: string; bn: string };
  city: { en: string; bn: string };
  center: GeoPoint;
  boundary: Polygon;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileDoc {
  _id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  locale: Locale;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  emailVerifiedAt: Date | null;
  emailVerificationTokenHash: string | null;
  emailVerificationExpiresAt: Date | null;
}

export interface SessionDoc {
  /** SHA-256 of the session token; the raw token only exists in the cookie. */
  _id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IssueDoc {
  _id: string;
  category: CategoryId;
  title: string;
  description: string;
  /** APPROXIMATE public location (grid-snapped). */
  location: GeoPoint;
  areaId: string | null;
  status: IssueStatus;
  moderationState: ModerationState;
  /** Voting round; advances on resolve/reopen so people can vote again. */
  round: number;
  counts: { present: number; fixed: number; openFlags: number };
  createdAt: Date;
  updatedAt: Date;
  lastConfirmedAt: Date | null;
  lastActivityAt: Date;
  resolvedAt: Date | null;
  mergedInto: string | null;
  possibleDuplicateOf: string[];
  /** Approved photo shown publicly, if any. */
  publicPhotoId: string | null;
  photoPending: boolean;
  /** Status to return to after moderator review / un-archiving. */
  previousStatus: IssueStatus | null;
}

/** Private, moderator-only metadata for an issue. Never returned publicly. */
export interface IssuePrivateDoc {
  _id: string; // = issue id
  reporterId: string | null;
  /** HMAC of the reporter's IP, for abuse investigation. Not reversible without the secret. */
  reporterIpKey: string;
  createdAt: Date;
}

/** Exact coordinates, deleted automatically by a TTL index. */
export interface IssueExactLocationDoc {
  _id: string; // = issue id
  location: GeoPoint;
  expiresAt: Date;
}

export type PhotoState = "pending" | "approved" | "rejected";

export interface IssuePhotoDoc {
  _id: string;
  issueId: string;
  fileId: ObjectId;
  thumbFileId: ObjectId;
  width: number;
  height: number;
  bytes: number;
  moderationState: PhotoState;
  uploadedBy: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

export const UPDATE_TYPES = [
  "created",
  "confirmed_present",
  "reported_fixed",
  "status_changed",
  "reopened",
  "merged",
  "merged_from",
  "archived",
  "restored",
  "under_review",
  "review_cleared",
  "photo_added",
] as const;
export type UpdateType = (typeof UPDATE_TYPES)[number];

/** Public, append-only history. Contains no actor identity. */
export interface IssueUpdateDoc {
  _id: string;
  issueId: string;
  type: UpdateType;
  actorKind: "community" | "moderator" | "system";
  fromStatus: IssueStatus | null;
  toStatus: IssueStatus | null;
  createdAt: Date;
}

export interface IssueVoteDoc {
  _id: string;
  issueId: string;
  round: number;
  /** "u:<userId>" for accounts, "g:<hmac(ip)>" for guests, "d:<uuid>" after account deletion. */
  voterKey: string;
  userId: string | null;
  kind: "present" | "fixed";
  createdAt: Date;
}

export type FlagState = "open" | "dismissed" | "actioned";

export interface IssueFlagDoc {
  _id: string;
  issueId: string;
  reason: FlagReason;
  details: string;
  flaggerKey: string;
  userId: string | null;
  state: FlagState;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface ModerationEventDoc {
  _id: string;
  issueId: string | null;
  targetType: "issue" | "photo" | "flag" | "user";
  targetId: string;
  action: ModerationAction | "photo_approve" | "photo_reject" | "auto_under_review" | "role_change" | "account_deleted";
  /** Moderator's user id, or "system". Internal only. */
  actorId: string;
  from: string | null;
  to: string | null;
  /** Internal note; never exposed publicly. */
  note: string;
  createdAt: Date;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

export interface PollOptionDoc {
  id: string;
  text: string;
}

export interface PollDoc {
  _id: string;
  topic: "government" | "society" | "local" | "other";
  question: string;
  context: string;
  sourceUrl: string | null;
  options: PollOptionDoc[];
  status: "open" | "closed";
  /** Internal atomic gate serializes vote reservations against poll closure. */
  voteGate: number;
  closesAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Vote identity is a keyed hash of the request IP; raw IPs are never stored. */
export interface PollVoteDoc {
  _id: string;
  pollId: string;
  voterKey: string;
  deviceKey: string;
  accountKey: string;
  optionId: string;
  createdAt: Date;
}

export interface PollEventDoc {
  _id: string;
  pollId: string;
  actorId: string;
  action: "created" | "closed" | "reopened";
  createdAt: Date;
}

export interface MigrationDoc {
  _id: string;
  appliedAt: Date;
}
