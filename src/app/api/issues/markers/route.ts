import type { NextRequest } from "next/server";
import { listIssuesQuerySchema } from "@/lib/validation";
import { handler, json } from "@/server/http";
import { listMarkers } from "@/server/services/issues";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const q = listIssuesQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const markers = await listMarkers(q);
  return json({ markers }, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } });
});
