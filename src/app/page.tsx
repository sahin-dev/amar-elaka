import { APP_CONFIG } from "@/config/app-config";
import { parseBBox } from "@/lib/geo";
import { isDbConfigured } from "@/server/db";
import { ExploreView, type ExploreInitial } from "@/components/explore/explore-view";
import { SetupNotice } from "@/components/layout/setup-notice";

export const dynamic = "force-dynamic";

function num(v: string | string[] | undefined, min: number, max: number): number | null {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isDbConfigured()) return <SetupNotice />;
  const sp = await searchParams;
  const B = APP_CONFIG.bounds;
  const lat = num(sp.lat, B.minLat, B.maxLat);
  const lng = num(sp.lng, B.minLng, B.maxLng);
  const z = num(sp.z, 6, 19);
  const bbox = parseBBox(typeof sp.bbox === "string" ? sp.bbox : null);

  const initial: ExploreInitial = {
    center: lat !== null && lng !== null ? { lat, lng } : { lat: APP_CONFIG.defaultCenter.lat, lng: APP_CONFIG.defaultCenter.lng },
    zoom: z ?? APP_CONFIG.defaultCenter.zoom,
    bbox: bbox ? [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat] : null,
  };
  return <ExploreView initial={initial} />;
}
