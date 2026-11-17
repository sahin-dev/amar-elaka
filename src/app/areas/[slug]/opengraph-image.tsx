import { ImageResponse } from "next/og";
import { isDbConfigured } from "@/server/db";
import { getAreaBySlug, getAreaSummary } from "@/server/services/areas";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AmarElaka neighbourhood status";

/**
 * Share card for messaging apps. Uses the English area name because the
 * default OG font has no Bangla glyphs (see README → Known limitations).
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = isDbConfigured() ? await getAreaBySlug(slug) : null;
  const s = area ? await getAreaSummary(area) : null;
  const stat = (label: string, n: number, color: string) => (
    <div style={{ display: "flex", flexDirection: "column", background: "#ffffff", borderRadius: 24, padding: "24px 32px", minWidth: 300 }}>
      <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color }}>{n}</div>
      <div style={{ display: "flex", fontSize: 26, color: "#5b6472" }}>{label}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #134f4b 0%, #167a71 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, opacity: 0.9 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ffffff", color: "#14625c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            A
          </div>
          AmarElaka · Neighbourhood status
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 34, opacity: 0.85 }}>{area?.city.en ?? "Bangladesh"}</div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>{area?.name.en ?? "Area not found"}</div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {stat("Unresolved", s?.unresolved ?? 0, "#b45309")}
          {stat("Community verified", s?.verified ?? 0, "#c2410c")}
          {stat("Community-resolved (30d)", s?.resolvedRecent ?? 0, "#15803d")}
        </div>
        <div style={{ display: "flex", fontSize: 22, opacity: 0.8 }}>Community-submitted reports · not official government data</div>
      </div>
    ),
    size,
  );
}
