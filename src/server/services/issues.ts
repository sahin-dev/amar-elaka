import "server-only";
import { randomUUID } from "node:crypto";
import type { Filter } from "mongodb";
import { APP_CONFIG, getCategory, type IssueStatus } from "@/config/app-config";
import { AppError } from "@/lib/errors";
import { approximateLocation, bboxToPolygon, parseBBox, toGeoPoint, type LatLng } from "@/lib/geo";
import type {
  IssueListResponse,
  MapMarker,
  PublicIssue,
  PublicIssueSummary,
  PublicIssueUpdate,
  StatusSummary,
} from "@/lib/public-types";
import type { CreateReportInput, ListIssuesQuery } from "@/lib/validation";
import { isModerator, type SessionUser } from "@/server/auth/session";
import { collections, getDb } from "@/server/db";
import { toIssueSummary, toMarker, toPublicIssue, toPublicUpdate } from "@/server/dto";
import { enforceRateLimit } from "@/server/rate-limit";
import { findAreaForPoint, getAreaBySlug, getAreasByIds, PUBLIC_ISSUE_FILTER } from "@/server/services/areas";
import { processPhoto, storePhoto, type ProcessedPhoto } from "@/server/services/photos";
import type { IssueDoc, IssueUpdateDoc } from "@/server/types";

const OPEN: IssueStatus[] = ["reported", "community_verified", "under_review"];

async function buildFilter(q: Pick<ListIssuesQuery, "bbox" | "category" | "status" | "area">): Promise<Filter<IssueDoc> | null> {
  const filter: Filter<IssueDoc> = { ...PUBLIC_ISSUE_FILTER };
  if (q.bbox) {
    const bbox = parseBBox(q.bbox);
    if (!bbox) throw new AppError("VALIDATION", "Invalid map bounds.", { fields: { bbox: "Invalid bounds" } });
    filter.location = { $geoWithin: { $geometry: bboxToPolygon(bbox) } };
  }
  if (q.category.length) filter.category = { $in: q.category };
  filter.status = q.status.length ? { $in: q.status } : { $ne: "archived" };
  if (q.area) {
    const area = await getAreaBySlug(q.area);
    if (!area) return null;
    filter.areaId = area._id;
  }
  return filter;
}

export async function listIssues(q: ListIssuesQuery, opts: { withSummary?: boolean } = {}): Promise<IssueListResponse> {
  const filter = await buildFilter(q);
  if (!filter) return { items: [], page: q.page, hasMore: false };
  const { issues } = collections(await getDb());
  const docs = await issues
    .find(filter)
    .sort({ lastActivityAt: -1, _id: 1 })
    .skip((q.page - 1) * q.limit)
    .limit(q.limit + 1)
    .toArray();
  const hasMore = docs.length > q.limit;
  const page = docs.slice(0, q.limit);
  const areas = await getAreasByIds(page.map((d) => d.areaId));
  const now = new Date();
  const res: IssueListResponse = {
    items: page.map((d) => toIssueSummary(d, d.areaId ? areas.get(d.areaId) : null, now)),
    page: q.page,
    hasMore,
  };
  if (opts.withSummary) res.summary = await summarize(filter);
  return res;
}

async function summarize(filter: Filter<IssueDoc>): Promise<StatusSummary> {
  const { issues } = collections(await getDb());
  // Summary ignores the status filter so the counts describe the whole view.
  const { status: _ignored, ...rest } = filter;
  void _ignored;
  const rows = await issues
    .aggregate<{ _id: IssueStatus; n: number }>([
      { $match: { ...rest, status: { $ne: "archived" } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ])
    .toArray();
  const get = (s: IssueStatus) => rows.find((r) => r._id === s)?.n ?? 0;
  const open = get("reported") + get("community_verified") + get("under_review");
  return { open, verified: get("community_verified"), resolved: get("community_resolved"), total: open + get("community_resolved") };
}

export async function listMarkers(q: Pick<ListIssuesQuery, "bbox" | "category" | "status" | "area">): Promise<MapMarker[]> {
  const filter = await buildFilter(q);
  if (!filter) return [];
  const { issues } = collections(await getDb());
  const docs = await issues
    .find(filter, { projection: { _id: 1, location: 1, category: 1, status: 1, title: 1 } })
    .sort({ lastActivityAt: -1 })
    .limit(APP_CONFIG.pagination.maxMapMarkers)
    .toArray();
  return docs.map(toMarker);
}

/**
 * Fetch an issue for a given viewer, enforcing visibility:
 * - visible / merged: everyone
 * - pending / hidden / rejected: only moderators and the original reporter
 * - removed: only moderators
 */
export async function getIssueForViewer(id: string, viewer: SessionUser | null): Promise<PublicIssue | null> {
  const db = await getDb();
  const { issues, issuePrivate } = collections(db);
  const doc = await issues.findOne({ _id: id });
  if (!doc) return null;
  if (doc.moderationState !== "visible" && doc.moderationState !== "merged") {
    if (!viewer) return null;
    if (!isModerator(viewer)) {
      if (doc.moderationState === "removed") return null;
      const priv = await issuePrivate.findOne({ _id: id }, { projection: { reporterId: 1 } });
      if (priv?.reporterId !== viewer.id) return null;
    }
  }
  const areas = await getAreasByIds([doc.areaId]);
  return toPublicIssue(doc, doc.areaId ? areas.get(doc.areaId) : null);
}

export async function getIssueHistory(id: string): Promise<PublicIssueUpdate[]> {
  const { issueUpdates } = collections(await getDb());
  const docs = await issueUpdates.find({ issueId: id }).sort({ createdAt: 1 }).limit(200).toArray();
  return docs.map(toPublicUpdate);
}

/** Open, recent reports of the same category near a point. */
export async function findPossibleDuplicates(category: string, p: LatLng, now = new Date()): Promise<PublicIssueSummary[]> {
  const { issues } = collections(await getDb());
  // Public locations are grid-snapped; widen the radius by about half a cell diagonal.
  const radiusM = getCategory(category).duplicateRadiusM + 120;
  const since = new Date(now.getTime() - APP_CONFIG.reports.duplicateLookbackDays * 86_400_000);
  const docs = await issues
    .find({
      moderationState: { $in: ["visible", "pending"] },
      category: category as IssueDoc["category"],
      status: { $in: OPEN },
      createdAt: { $gte: since },
      location: { $geoWithin: { $centerSphere: [[p.lng, p.lat], radiusM / 6_378_100] } },
    })
    .sort({ lastActivityAt: -1 })
    .limit(3)
    .toArray();
  const areas = await getAreasByIds(docs.map((d) => d.areaId));
  return docs.filter((d) => d.moderationState === "visible").map((d) => toIssueSummary(d, d.areaId ? areas.get(d.areaId) : null, now));
}

export interface PhotoUpload {
  bytes: Buffer;
  mime: string;
}

export interface CreateIssueResult {
  id: string;
  moderationState: IssueDoc["moderationState"];
  photoPending: boolean;
}

export async function createIssue(
  input: CreateReportInput,
  ctx: { user: SessionUser | null; ipKey: string; photo?: PhotoUpload | null; now?: Date },
): Promise<CreateIssueResult> {
  const now = ctx.now ?? new Date();
  if (!ctx.user) throw new AppError("UNAUTHENTICATED", "Please sign in to submit a report.");
  if (!ctx.user.emailVerified) throw new AppError("EMAIL_NOT_VERIFIED", "Verify your email before submitting a report.");
  // Honeypot filled: almost certainly a bot.
  if (input.website) throw new AppError("VALIDATION", "Your report could not be submitted.");

  const db = await getDb();
  const c = collections(db);
  const RL = APP_CONFIG.rateLimits;
  await enforceRateLimit(c.rateLimits, `report:u:${ctx.user.id}`, RL.reportPerUser, now);
  await enforceRateLimit(c.rateLimits, `report:ip:${ctx.ipKey}`, RL.reportPerIp, now);

  const exact: LatLng = { lat: input.lat, lng: input.lng };

  const duplicates = await findPossibleDuplicates(input.category, exact, now);
  if (duplicates.length && !input.acknowledgeDuplicate) {
    throw new AppError("CONFLICT", "Similar reports already exist nearby.", { details: { duplicates } });
  }

  // Process the photo before writing anything so a bad file never leaves a half-created issue.
  let processed: ProcessedPhoto | null = null;
  if (ctx.photo) processed = await processPhoto(ctx.photo.bytes, ctx.photo.mime);

  const approx = approximateLocation(exact);
  const area = await findAreaForPoint(exact);
  const id = randomUUID();
  const moderationState = APP_CONFIG.reports.requireApproval ? "pending" : "visible";
  const photoNeedsReview = APP_CONFIG.photos.requireApproval;

  const issue: IssueDoc = {
    _id: id,
    category: input.category,
    title: input.title,
    description: input.description,
    location: toGeoPoint(approx),
    areaId: area?._id ?? null,
    status: "reported",
    moderationState,
    round: 0,
    counts: { present: 0, fixed: 0, openFlags: 0 },
    createdAt: now,
    updatedAt: now,
    lastConfirmedAt: null,
    lastActivityAt: now,
    resolvedAt: null,
    mergedInto: null,
    possibleDuplicateOf: duplicates.map((d) => d.id),
    publicPhotoId: null,
    photoPending: !!processed && photoNeedsReview,
    previousStatus: null,
  };

  await c.issues.insertOne(issue);
  await c.issuePrivate.insertOne({ _id: id, reporterId: ctx.user.id, reporterIpKey: ctx.ipKey, createdAt: now });
  await c.issueExactLocations.insertOne({
    _id: id,
    location: toGeoPoint(exact),
    expiresAt: new Date(now.getTime() + APP_CONFIG.privacy.exactLocationRetentionDays * 86_400_000),
  });
  await c.issueUpdates.insertOne(update(id, "created", "community", null, "reported", now));

  if (processed) {
    const photo = await storePhoto(db, id, processed, ctx.user.id, photoNeedsReview ? "pending" : "approved");
    if (!photoNeedsReview) {
      await c.issues.updateOne({ _id: id }, { $set: { publicPhotoId: photo._id } });
    }
  }

  return { id, moderationState, photoPending: issue.photoPending };
}

export function update(
  issueId: string,
  type: IssueUpdateDoc["type"],
  actorKind: IssueUpdateDoc["actorKind"],
  fromStatus: IssueStatus | null,
  toStatus: IssueStatus | null,
  createdAt = new Date(),
): IssueUpdateDoc {
  return { _id: randomUUID(), issueId, type, actorKind, fromStatus, toStatus, createdAt };
}

/** Reports created by this user (private list, includes moderation state). */
export async function listMyReports(user: SessionUser) {
  const { issuePrivate, issues } = collections(await getDb());
  const priv = await issuePrivate.find({ reporterId: user.id }, { projection: { _id: 1 } }).sort({ createdAt: -1 }).limit(100).toArray();
  if (!priv.length) return [];
  const docs = await issues.find({ _id: { $in: priv.map((p) => p._id) } }).sort({ createdAt: -1 }).toArray();
  const areas = await getAreasByIds(docs.map((d) => d.areaId));
  return docs.map((d) => ({ ...toIssueSummary(d, d.areaId ? areas.get(d.areaId) : null), moderationState: d.moderationState }));
}
