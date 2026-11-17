"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type L from "leaflet";
import { MAP_CONFIG } from "@/lib/map-config";
import type { MapMarker } from "@/lib/public-types";
import { issueIcon } from "./markers";

export interface MapView {
  bbox: [number, number, number, number];
  center: { lat: number; lng: number };
  zoom: number;
}

export interface IssueMapProps {
  markers: MapMarker[];
  initialCenter: { lat: number; lng: number };
  initialZoom: number;
  /** When set, the map fits these bounds ([minLng,minLat,maxLng,maxLat]). Change the `key` to refit. */
  fitBounds?: { key: string; bbox: [number, number, number, number] } | null;
  flyTo?: { key: string; lat: number; lng: number; zoom?: number } | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onViewChange?: (v: MapView) => void;
  ariaLabel: string;
  className?: string;
}

function ViewReporter({ onViewChange }: { onViewChange?: (v: MapView) => void }) {
  const map = useMap();
  const report = () => {
    const b = map.getBounds();
    const c = map.getCenter();
    onViewChange?.({
      bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => Math.round(n * 1e5) / 1e5) as MapView["bbox"],
      center: { lat: c.lat, lng: c.lng },
      zoom: map.getZoom(),
    });
  };
  useMapEvents({ moveend: report });
  useEffect(() => {
    report();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function Controller({ fitBounds, flyTo }: Pick<IssueMapProps, "fitBounds" | "flyTo">) {
  const map = useMap();
  const lastFit = useRef<string | null>(null);
  const lastFly = useRef<string | null>(null);
  useEffect(() => {
    if (fitBounds && fitBounds.key !== lastFit.current) {
      lastFit.current = fitBounds.key;
      const [w, s, e, n] = fitBounds.bbox;
      map.fitBounds([[s, w], [n, e]], { padding: [24, 24] });
    }
  }, [fitBounds, map]);
  useEffect(() => {
    if (flyTo && flyTo.key !== lastFly.current) {
      lastFly.current = flyTo.key;
      map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
  }, [flyTo, map]);
  return null;
}

export default function IssueMap(props: IssueMapProps) {
  const { markers, selectedId, onSelect } = props;
  const mapRef = useRef<L.Map | null>(null);

  // Leaflet sizes itself on mount; recompute when the container is revealed (map/list toggle).
  useEffect(() => {
    const el = mapRef.current?.getContainer();
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={props.className} role="region" aria-label={props.ariaLabel}>
      <MapContainer
        ref={mapRef}
        center={[props.initialCenter.lat, props.initialCenter.lng]}
        zoom={props.initialZoom}
        maxZoom={MAP_CONFIG.maxZoom}
        minZoom={6}
        className="h-full w-full"
        zoomControl
        attributionControl
        preferCanvas
      >
        <TileLayer url={MAP_CONFIG.tileUrl} attribution={MAP_CONFIG.attribution} maxZoom={MAP_CONFIG.maxZoom} detectRetina={false} />
        <ViewReporter onViewChange={props.onViewChange} />
        <Controller fitBounds={props.fitBounds} flyTo={props.flyTo} />
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={issueIcon(m.category, m.status, m.id === selectedId)}
            title={m.title}
            alt={m.title}
            keyboard
            zIndexOffset={m.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(m.id) }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
