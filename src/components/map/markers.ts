import L from "leaflet";
import { getCategory, type IssueStatus } from "@/config/app-config";
import { CATEGORY_ICON_SVG } from "@/components/ui/icons";

const cache = new Map<string, L.DivIcon>();

/** Category-coloured pin. Resolved/archived issues are muted so live problems stand out. */
export function issueIcon(category: string, status: IssueStatus, selected: boolean): L.DivIcon {
  const key = `${category}:${status}:${selected}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = getCategory(category);
  const size = selected ? 40 : 32;
  const muted = status === "community_resolved" || status === "archived";
  const bg = muted ? "#ffffff" : c.color;
  const fg = muted ? c.color : "#ffffff";
  const ring = selected ? "#111827" : muted ? c.color : "#ffffff";
  const check =
    status === "community_resolved"
      ? `<span style="position:absolute;right:-3px;bottom:-3px;width:15px;height:15px;border-radius:50%;background:#15803d;border:2px solid #fff;display:flex;align-items:center;justify-content:center"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>`
      : "";
  const html = `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:${selected ? 3 : 2}px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:${fg}"><svg width="${Math.round(size * 0.5)}" height="${Math.round(size * 0.5)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CATEGORY_ICON_SVG[c.icon]}</svg>${check}</div>`;
  const icon = L.divIcon({ html, className: "ae-marker", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  cache.set(key, icon);
  return icon;
}

export function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: "ae-marker",
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    html: `<svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43s15-14.2 15-26A15 15 0 0 0 2 17c0 11.8 15 26 15 26z" fill="#14625c" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="17" r="5.5" fill="#fff"/></svg>`,
  });
}
