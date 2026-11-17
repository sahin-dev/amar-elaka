import "server-only";
import { getFreshness } from "@/lib/freshness";
import { fromGeoPoint } from "@/lib/geo";
import type { MapMarker, PublicAreaRef, PublicIssue, PublicIssueSummary, PublicIssueUpdate } from "@/lib/public-types";
import type { AreaDoc, IssueDoc, IssueUpdateDoc } from "./types";

export function areaRef(a: AreaDoc | null | undefined): PublicAreaRef | null {
  return a ? { slug: a.slug, name: a.name } : null;
}

function excerpt(s: string, n = 140): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function toIssueSummary(i: IssueDoc, area: AreaDoc | null | undefined, now = new Date()): PublicIssueSummary {
  const { lat, lng } = fromGeoPoint(i.location);
  return {
    id: i._id,
    category: i.category,
    title: i.title,
    excerpt: excerpt(i.description),
    lat,
    lng,
    status: i.status,
    freshness: getFreshness(i.createdAt, i.lastConfirmedAt, now),
    createdAt: i.createdAt.toISOString(),
    lastActivityAt: i.lastActivityAt.toISOString(),
    lastConfirmedAt: i.lastConfirmedAt?.toISOString() ?? null,
    presentCount: i.counts.present,
    photoId: i.publicPhotoId,
    area: areaRef(area),
  };
}

export function toPublicIssue(i: IssueDoc, area: AreaDoc | null | undefined, now = new Date()): PublicIssue {
  return {
    ...toIssueSummary(i, area, now),
    description: i.description,
    fixedCount: i.counts.fixed,
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    photoPending: i.photoPending,
    mergedInto: i.moderationState === "merged" ? i.mergedInto : null,
    notPublic: i.moderationState !== "visible" && i.moderationState !== "merged",
  };
}

export function toMarker(i: Pick<IssueDoc, "_id" | "location" | "category" | "status" | "title">): MapMarker {
  const { lat, lng } = fromGeoPoint(i.location);
  return { id: i._id, lat, lng, category: i.category, status: i.status, title: i.title };
}

export function toPublicUpdate(u: IssueUpdateDoc): PublicIssueUpdate {
  return { id: u._id, type: u.type, actorKind: u.actorKind, toStatus: u.toStatus, createdAt: u.createdAt.toISOString() };
}
