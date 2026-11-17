import { APP_CONFIG } from "@/config/app-config";

export type Freshness = "recent" | "check" | "outdated";

/**
 * Freshness is based on the most recent community confirmation, falling back
 * to creation time. Stale reports must never be presented as live facts.
 */
export function getFreshness(
  createdAt: Date,
  lastConfirmedAt: Date | null | undefined,
  now: Date = new Date(),
  cfg: { recentHours: number; checkHours: number } = APP_CONFIG.freshness,
): Freshness {
  const ref = lastConfirmedAt && lastConfirmedAt > createdAt ? lastConfirmedAt : createdAt;
  const ageHours = (now.getTime() - ref.getTime()) / 3_600_000;
  if (ageHours < cfg.recentHours) return "recent";
  if (ageHours < cfg.checkHours) return "check";
  return "outdated";
}
