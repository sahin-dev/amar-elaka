import { APP_CONFIG } from "@/config/app-config";

export interface LatLng {
  lat: number;
  lng: number;
}

/** GeoJSON order is [lng, lat]. */
export type GeoPoint = { type: "Point"; coordinates: [number, number] };

export function toGeoPoint(p: LatLng): GeoPoint {
  return { type: "Point", coordinates: [p.lng, p.lat] };
}

export function fromGeoPoint(g: GeoPoint): LatLng {
  return { lng: g.coordinates[0], lat: g.coordinates[1] };
}

export function isInBangladesh(p: LatLng): boolean {
  const b = APP_CONFIG.bounds;
  return p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;
}

/**
 * Privacy-preserving public location: snap to the centre of a fixed grid cell.
 * Deterministic, so many reports from one home never reveal more than the cell.
 */
export function approximateLocation(p: LatLng, gridDeg: number = APP_CONFIG.privacy.publicGridDeg): LatLng {
  const snap = (v: number) => (Math.floor(v / gridDeg) + 0.5) * gridDeg;
  // Round to 6 decimals to avoid float noise in stored values.
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return { lat: r(snap(p.lat)), lng: r(snap(p.lng)) };
}

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** Parse "minLng,minLat,maxLng,maxLat"; returns null if malformed or absurd. */
export function parseBBox(raw: string | null | undefined): BBox | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (minLng >= maxLng || minLat >= maxLat) return null;
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  return { minLng, minLat, maxLng, maxLat };
}

export function bboxToPolygon(b: BBox) {
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [b.minLng, b.minLat],
        [b.maxLng, b.minLat],
        [b.maxLng, b.maxLat],
        [b.minLng, b.maxLat],
        [b.minLng, b.minLat],
      ],
    ],
  };
}

export function formatDistance(m: number, locale: "en" | "bn"): string {
  const nf = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en", { maximumFractionDigits: m < 10_000 ? 1 : 0 });
  if (m < 1000) {
    const v = Math.max(10, Math.round(m / 10) * 10);
    return locale === "bn" ? `${nf.format(v)} মি` : `${nf.format(v)} m`;
  }
  return locale === "bn" ? `${nf.format(m / 1000)} কিমি` : `${nf.format(m / 1000)} km`;
}
