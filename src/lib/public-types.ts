import type { CategoryId, IssueStatus } from "@/config/app-config";
import type { Freshness } from "@/lib/freshness";

/**
 * Public API shapes. These are the ONLY issue shapes that leave the server
 * for anonymous viewers: no reporter identity, no exact coordinates, no
 * moderation notes or private metadata.
 */

export interface PublicAreaRef {
  slug: string;
  name: { en: string; bn: string };
}

export interface PublicIssueSummary {
  id: string;
  category: CategoryId;
  title: string;
  excerpt: string;
  /** Approximate (grid-snapped) coordinates. */
  lat: number;
  lng: number;
  status: IssueStatus;
  freshness: Freshness;
  createdAt: string;
  lastActivityAt: string;
  lastConfirmedAt: string | null;
  presentCount: number;
  photoId: string | null;
  area: PublicAreaRef | null;
}

export interface PublicIssue extends PublicIssueSummary {
  description: string;
  fixedCount: number;
  resolvedAt: string | null;
  photoPending: boolean;
  mergedInto: string | null;
  /** True only when shown to its moderator/author while not public. */
  notPublic: boolean;
}

export interface PublicIssueUpdate {
  id: string;
  type: string;
  actorKind: "community" | "moderator" | "system";
  toStatus: IssueStatus | null;
  createdAt: string;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  category: CategoryId;
  status: IssueStatus;
  title: string;
}

export interface StatusSummary {
  open: number;
  verified: number;
  resolved: number;
  total: number;
}

export interface IssueListResponse {
  items: PublicIssueSummary[];
  page: number;
  hasMore: boolean;
  summary?: StatusSummary;
}

export type PollTopic = "government" | "society" | "local" | "other";
export interface PublicPoll {
  id: string;
  topic: PollTopic;
  question: string;
  context: string;
  sourceUrl: string | null;
  options: { id: string; text: string; votes: number; percent: number }[];
  totalVotes: number;
  status: "open" | "closed";
  closesAt: string | null;
  createdAt: string;
  hasVoted: boolean;
}

export interface AreaSummary {
  area: PublicAreaRef & { city: { en: string; bn: string }; center: { lat: number; lng: number }; bbox: [number, number, number, number] };
  total: number;
  unresolved: number;
  verified: number;
  resolvedRecent: number;
  byStatus: Record<IssueStatus, number>;
  byCategory: Partial<Record<CategoryId, number>>;
  lastUpdated: string | null;
}
