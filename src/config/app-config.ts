/**
 * Central, version-controlled product configuration.
 *
 * Categories, thresholds and freshness windows live here so they can be
 * reviewed in code review and changed without touching business logic.
 * Values that operators may want to flip per deployment read from env.
 */

export const CATEGORY_IDS = [
  "waterlogging",
  "pothole",
  "streetlight",
  "garbage",
  "blocked_road",
  "other",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryConfig {
  id: CategoryId;
  label: { en: string; bn: string };
  /** Marker / chip colour. Chosen for >= 3:1 contrast against white. */
  color: string;
  /** Icon key, see components/ui/icons.tsx */
  icon: "drop" | "road" | "bulb" | "trash" | "barrier" | "dots";
  /** Radius (metres) used for duplicate detection for this category. */
  duplicateRadiusM: number;
}

export const CATEGORIES: readonly CategoryConfig[] = [
  { id: "waterlogging", label: { en: "Waterlogging / flooding", bn: "জলাবদ্ধতা / বন্যা" }, color: "#1d6fb8", icon: "drop", duplicateRadiusM: 250 },
  { id: "pothole", label: { en: "Pothole / road damage", bn: "গর্ত / রাস্তা ভাঙা" }, color: "#a15c07", icon: "road", duplicateRadiusM: 120 },
  { id: "streetlight", label: { en: "Broken streetlight", bn: "নষ্ট সড়কবাতি" }, color: "#8a6d00", icon: "bulb", duplicateRadiusM: 80 },
  { id: "garbage", label: { en: "Garbage / waste", bn: "ময়লা / বর্জ্য" }, color: "#4d7c0f", icon: "trash", duplicateRadiusM: 120 },
  { id: "blocked_road", label: { en: "Blocked road", bn: "রাস্তা বন্ধ" }, color: "#b42318", icon: "barrier", duplicateRadiusM: 150 },
  { id: "other", label: { en: "Other public-space problem", bn: "অন্যান্য জনসমস্যা" }, color: "#5b6472", icon: "dots", duplicateRadiusM: 60 },
] as const;

export function getCategory(id: string): CategoryConfig {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

export const ISSUE_STATUSES = [
  "reported",
  "community_verified",
  "under_review",
  "community_resolved",
  "archived",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Moderation state is kept separate from the public status. */
export const MODERATION_STATES = ["visible", "pending", "hidden", "rejected", "merged", "removed"] as const;
export type ModerationState = (typeof MODERATION_STATES)[number];

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1";
}

export const APP_CONFIG = {
  /** Bangladesh bounding box (generous). Reports outside are rejected. */
  bounds: { minLat: 20.5, maxLat: 26.8, minLng: 88.0, maxLng: 92.8 },
  /** Default map view: Dhaka. */
  defaultCenter: { lat: 23.7808, lng: 90.4093, zoom: 12 },

  privacy: {
    /**
     * Public coordinates are snapped to a grid of this size (degrees).
     * 0.0015° ≈ 165 m latitude in Bangladesh. Snapping (not random noise)
     * means repeated reports cannot be averaged to recover the exact point.
     */
    publicGridDeg: 0.0015,
    /** Exact coordinates are kept (protected) for this many days, then deleted. */
    exactLocationRetentionDays: 90,
  },

  community: {
    /** Distinct "present" confirmations needed for Community verified. */
    verifyThreshold: 2,
    /** Distinct "fixed" reports needed for Community-reported resolved. */
    resolutionThreshold: 2,
    /** Fixed reports must fall inside this window to count. */
    resolutionWindowHours: 48,
    /** Distinct "present" confirmations after resolution needed to reopen. */
    reopenThreshold: 2,
    /** Only signed-in accounts may report "fixed" (abuse control). */
    fixedVoteRequiresAccount: true,
    /** Open flags that automatically put a report Under review. */
    flagReviewThreshold: 3,
  },

  /** Freshness labels, based on the last confirmation (or creation). */
  freshness: {
    recentHours: 24,
    checkHours: 72,
  },

  reports: {
    titleMin: 8,
    titleMax: 100,
    descriptionMax: 1000,
    requireApproval: envBool("REPORTS_REQUIRE_APPROVAL", false),
    duplicateLookbackDays: 14,
  },

  photos: {
    maxBytes: 5 * 1024 * 1024,
    allowedMime: ["image/jpeg", "image/png", "image/webp"] as const,
    maxDimension: 1280,
    thumbDimension: 320,
    maxInputPixels: 40_000_000,
    requireApproval: envBool("PHOTOS_REQUIRE_APPROVAL", true),
  },

  /** Rate limits: [max requests, window in seconds]. */
  rateLimits: {
    reportPerUser: [5, 60 * 60],
    reportPerIp: [10, 60 * 60],
    votePerUser: [60, 60 * 60],
    votePerGuest: [20, 60 * 60],
    pollVotePerIp: [10, 60 * 60],
    flagPerUser: [20, 60 * 60],
    flagPerGuest: [5, 60 * 60],
    loginPerIp: [20, 15 * 60],
    loginPerEmail: [6, 15 * 60],
    signupPerIp: [5, 60 * 60],
    verificationResendPerUser: [3, 60 * 60],
    verificationResendPerIp: [10, 60 * 60],
  } satisfies Record<string, [number, number]>,

  pagination: { pageSize: 20, maxPageSize: 50, maxMapMarkers: 300 },

  session: { days: 30 },
} as const;

export type AppConfig = typeof APP_CONFIG;
