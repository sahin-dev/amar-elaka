"use client";

import { MiniMap } from "@/components/map";

/** Client boundary so server pages can render the lazily-loaded Leaflet mini map. */
export function ClientMiniMap(props: { lat: number; lng: number; category: string; ariaLabel: string }) {
  return <MiniMap {...props} />;
}
