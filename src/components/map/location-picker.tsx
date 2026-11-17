"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import type L from "leaflet";
import { MapContainer, Marker, Rectangle, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { APP_CONFIG } from "@/config/app-config";
import { approximateLocation, type LatLng } from "@/lib/geo";
import { MAP_CONFIG } from "@/lib/map-config";
import { pinIcon } from "./markers";

export interface LocationPickerProps {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  center?: LatLng;
  flyKey?: string;
  ariaLabel: string;
}

function ClickToPlace({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyTo({ value, flyKey }: { value: LatLng | null; flyKey?: string }) {
  const map = useMap();
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (value && flyKey && flyKey !== last.current) {
      last.current = flyKey;
      map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 17), { duration: 0.5 });
    }
  }, [flyKey, value, map]);
  return null;
}

export default function LocationPicker({ value, onChange, center, flyKey, ariaLabel }: LocationPickerProps) {
  const start = value ?? center ?? APP_CONFIG.defaultCenter;
  const icon = useMemo(() => pinIcon(), []);

  // Show the public grid cell so people see exactly what will be published.
  const cell = useMemo(() => {
    if (!value) return null;
    const g = APP_CONFIG.privacy.publicGridDeg;
    const a = approximateLocation(value);
    return [
      [a.lat - g / 2, a.lng - g / 2],
      [a.lat + g / 2, a.lng + g / 2],
    ] as [[number, number], [number, number]];
  }, [value]);

  return (
    <div role="region" aria-label={ariaLabel} className="h-full w-full">
      <MapContainer center={[start.lat, start.lng]} zoom={value ? 17 : 13} maxZoom={MAP_CONFIG.maxZoom} className="h-full w-full">
        <TileLayer url={MAP_CONFIG.tileUrl} attribution={MAP_CONFIG.attribution} maxZoom={MAP_CONFIG.maxZoom} />
        <ClickToPlace onChange={onChange} />
        <FlyTo value={value} flyKey={flyKey} />
        {cell && <Rectangle bounds={cell} pathOptions={{ color: "#14625c", weight: 1, dashArray: "4 4", fillOpacity: 0.08 }} />}
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={icon}
            draggable
            keyboard
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onChange({ lat: ll.lat, lng: ll.lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
