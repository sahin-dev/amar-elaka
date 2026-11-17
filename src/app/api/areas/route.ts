import type { NextRequest } from "next/server";
import { fromGeoPoint } from "@/lib/geo";
import { handler, json } from "@/server/http";
import { areaBBox, listAreas, searchAreas } from "@/server/services/areas";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
  const areas = q ? await searchAreas(q) : await listAreas();
  return json(
    {
      areas: areas.map((a) => ({
        slug: a.slug,
        name: a.name,
        city: a.city,
        center: fromGeoPoint(a.center),
        bbox: areaBBox(a),
      })),
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
});
