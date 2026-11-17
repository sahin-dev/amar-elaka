/**
 * Reference neighbourhood areas (production-safe).
 *
 * Boundaries are APPROXIMATE rectangles drawn for an MVP so issues can be
 * grouped into shareable area pages. They are not official ward or
 * thana boundaries. Replace them with authoritative polygons (e.g. from
 * OpenStreetMap admin boundaries, checking the ODbL licence) before relying
 * on them for anything beyond grouping.
 *
 * bbox: [minLng, minLat, maxLng, maxLat]
 */
export interface AreaSeed {
  slug: string;
  name: { en: string; bn: string };
  city: { en: string; bn: string };
  bbox: [number, number, number, number];
}

const DHAKA = { en: "Dhaka", bn: "ঢাকা" };
const CTG = { en: "Chattogram", bn: "চট্টগ্রাম" };

export const AREAS: AreaSeed[] = [
  { slug: "mirpur", name: { en: "Mirpur", bn: "মিরপুর" }, city: DHAKA, bbox: [90.34, 23.79, 90.385, 23.84] },
  { slug: "mohammadpur", name: { en: "Mohammadpur", bn: "মোহাম্মদপুর" }, city: DHAKA, bbox: [90.345, 23.755, 90.368, 23.775] },
  { slug: "dhanmondi", name: { en: "Dhanmondi", bn: "ধানমন্ডি" }, city: DHAKA, bbox: [90.365, 23.735, 90.387, 23.755] },
  { slug: "tejgaon", name: { en: "Tejgaon", bn: "তেজগাঁও" }, city: DHAKA, bbox: [90.385, 23.755, 90.405, 23.775] },
  { slug: "banani", name: { en: "Banani", bn: "বনানী" }, city: DHAKA, bbox: [90.395, 23.785, 90.408, 23.8] },
  { slug: "gulshan", name: { en: "Gulshan", bn: "গুলশান" }, city: DHAKA, bbox: [90.408, 23.775, 90.425, 23.802] },
  { slug: "badda", name: { en: "Badda", bn: "বাড্ডা" }, city: DHAKA, bbox: [90.425, 23.765, 90.445, 23.795] },
  { slug: "rampura", name: { en: "Rampura", bn: "রামপুরা" }, city: DHAKA, bbox: [90.41, 23.76, 90.425, 23.775] },
  { slug: "khilgaon", name: { en: "Khilgaon", bn: "খিলগাঁও" }, city: DHAKA, bbox: [90.42, 23.74, 90.44, 23.76] },
  { slug: "motijheel", name: { en: "Motijheel", bn: "মতিঝিল" }, city: DHAKA, bbox: [90.41, 23.72, 90.43, 23.74] },
  { slug: "old-dhaka", name: { en: "Old Dhaka", bn: "পুরান ঢাকা" }, city: DHAKA, bbox: [90.39, 23.7, 90.42, 23.72] },
  { slug: "jatrabari", name: { en: "Jatrabari", bn: "যাত্রাবাড়ী" }, city: DHAKA, bbox: [90.425, 23.7, 90.45, 23.72] },
  { slug: "uttara", name: { en: "Uttara", bn: "উত্তরা" }, city: DHAKA, bbox: [90.36, 23.855, 90.41, 23.89] },
  { slug: "agrabad", name: { en: "Agrabad", bn: "আগ্রাবাদ" }, city: CTG, bbox: [91.8, 22.315, 91.825, 22.335] },
  { slug: "nasirabad", name: { en: "Nasirabad / GEC", bn: "নাসিরাবাদ / জিইসি" }, city: CTG, bbox: [91.81, 22.35, 91.835, 22.37] },
  { slug: "zindabazar", name: { en: "Zindabazar", bn: "জিন্দাবাজার" }, city: { en: "Sylhet", bn: "সিলেট" }, bbox: [91.86, 24.89, 91.88, 24.9] },
  { slug: "shaheb-bazar", name: { en: "Shaheb Bazar", bn: "সাহেব বাজার" }, city: { en: "Rajshahi", bn: "রাজশাহী" }, bbox: [88.585, 24.36, 88.6, 24.372] },
  { slug: "sonadanga", name: { en: "Sonadanga", bn: "সোনাডাঙ্গা" }, city: { en: "Khulna", bn: "খুলনা" }, bbox: [89.535, 22.81, 89.555, 22.825] },
];

export function bboxPolygon([w, s, e, n]: [number, number, number, number]) {
  return { type: "Polygon" as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
}
