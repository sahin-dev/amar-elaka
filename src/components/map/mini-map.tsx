"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import { getCategory } from "@/config/app-config";
import { MAP_CONFIG } from "@/lib/map-config";

/** Static map showing an APPROXIMATE area (circle), never a precise pin. */
export default function MiniMap({ lat, lng, category, ariaLabel }: { lat: number; lng: number; category: string; ariaLabel: string }) {
  const color = getCategory(category).color;
  return (
    <div role="img" aria-label={ariaLabel} className="h-full w-full">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        className="h-full w-full"
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
      >
        <TileLayer url={MAP_CONFIG.tileUrl} attribution={MAP_CONFIG.attribution} maxZoom={MAP_CONFIG.maxZoom} />
        <Circle center={[lat, lng]} radius={120} pathOptions={{ color, weight: 1.5, fillOpacity: 0.15 }} />
        <CircleMarker center={[lat, lng]} radius={6} pathOptions={{ color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }} />
      </MapContainer>
    </div>
  );
}
