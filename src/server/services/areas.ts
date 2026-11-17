import "server-only";
import { ISSUE_STATUSES, type IssueStatus } from "@/config/app-config";
import { fromGeoPoint, toGeoPoint, type LatLng } from "@/lib/geo";
import type { AreaSummary, PublicIssueSummary } from "@/lib/public-types";
import { getCollections } from "@/server/db";
import { toIssueSummary } from "@/server/dto";
import type { AreaDoc } from "@/server/types";

export const PUBLIC_ISSUE_FILTER = { moderationState: "visible" as const };

export async function listAreas(): Promise<AreaDoc[]> {
  const { areas } = await getCollections();
  return areas.find({ isActive: true }).sort({ "city.en": 1, "name.en": 1 }).limit(500).toArray();
}

export async function getAreaBySlug(slug: string): Promise<AreaDoc | null> {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const { areas } = await getCollections();
  return areas.findOne({ slug, isActive: true });
}

export async function getAreasByIds(ids: (string | null)[]): Promise<Map<string, AreaDoc>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const { areas } = await getCollections();
  const docs = await areas.find({ _id: { $in: unique } }).toArray();
  return new Map(docs.map((a) => [a._id, a]));
}

/** Which area polygon contains this point (null if none). */
export async function findAreaForPoint(p: LatLng): Promise<AreaDoc | null> {
  const { areas } = await getCollections();
  return areas.findOne({ isActive: true, boundary: { $geoIntersects: { $geometry: toGeoPoint(p) } } });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchAreas(q: string, limit = 8): Promise<AreaDoc[]> {
  const term = q.trim().slice(0, 60);
  if (!term) return [];
  const re = new RegExp(escapeRegex(term), "i");
  const { areas } = await getCollections();
  return areas
    .find({ isActive: true, $or: [{ "name.en": re }, { "name.bn": re }, { slug: re }, { "city.en": re }, { "city.bn": re }] })
    .limit(limit)
    .toArray();
}

export function areaBBox(a: AreaDoc): [number, number, number, number] {
  const ring = a.boundary.coordinates[0] ?? [];
  const lngs = ring.map((c) => c[0]!);
  const lats = ring.map((c) => c[1]!);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

export async function getAreaSummary(area: AreaDoc, now = new Date()): Promise<AreaSummary> {
  const { issues } = await getCollections();
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const [agg] = await issues
    .aggregate<{
      byStatus: { _id: IssueStatus; n: number }[];
      byCategory: { _id: string; n: number }[];
      resolvedRecent: { n: number }[];
      last: { at: Date }[];
    }>([
      { $match: { ...PUBLIC_ISSUE_FILTER, areaId: area._id } },
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
          byCategory: [
            { $match: { status: { $in: ["reported", "community_verified", "under_review"] } } },
            { $group: { _id: "$category", n: { $sum: 1 } } },
          ],
          resolvedRecent: [{ $match: { status: "community_resolved", resolvedAt: { $gte: since30 } } }, { $count: "n" }],
          last: [{ $sort: { lastActivityAt: -1 } }, { $limit: 1 }, { $project: { _id: 0, at: "$lastActivityAt" } }],
        },
      },
    ])
    .toArray();

  const byStatus = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, 0])) as Record<IssueStatus, number>;
  for (const r of agg?.byStatus ?? []) byStatus[r._id] = r.n;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const center = fromGeoPoint(area.center);

  return {
    area: { slug: area.slug, name: area.name, city: area.city, center, bbox: areaBBox(area) },
    total,
    unresolved: byStatus.reported + byStatus.community_verified + byStatus.under_review,
    verified: byStatus.community_verified,
    resolvedRecent: agg?.resolvedRecent[0]?.n ?? 0,
    byStatus,
    byCategory: Object.fromEntries((agg?.byCategory ?? []).map((r) => [r._id, r.n])),
    lastUpdated: agg?.last[0]?.at?.toISOString() ?? null,
  };
}

export async function getAreaIssues(
  area: AreaDoc,
  kind: "recent" | "unresolved" | "resolved",
  limit = 10,
): Promise<PublicIssueSummary[]> {
  const { issues } = await getCollections();
  const statusFilter =
    kind === "unresolved"
      ? { status: { $in: ["reported", "community_verified", "under_review"] as IssueStatus[] } }
      : kind === "resolved"
        ? { status: "community_resolved" as IssueStatus }
        : { status: { $ne: "archived" as IssueStatus } };
  const docs = await issues
    .find({ ...PUBLIC_ISSUE_FILTER, areaId: area._id, ...statusFilter })
    .sort(kind === "resolved" ? { resolvedAt: -1 } : { lastActivityAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => toIssueSummary(d, area));
}
