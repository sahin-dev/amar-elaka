import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { handler, json } from "@/server/http";
import { getAreaBySlug, getAreaIssues, getAreaSummary } from "@/server/services/areas";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
  const area = await getAreaBySlug((await ctx.params).slug);
  if (!area) throw new AppError("NOT_FOUND", "Area not found.");
  const [summary, recent] = await Promise.all([getAreaSummary(area), getAreaIssues(area, "recent", 10)]);
  return json({ summary, recent }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
});
