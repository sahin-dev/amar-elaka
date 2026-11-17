"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/states";

/**
 * Leaflet touches `window`, so map components load only on the client and
 * only when rendered. This also keeps ~40 KB of map code off pages without maps.
 */
const MapFallback = () => <Skeleton className="h-full w-full rounded-none" />;

export const IssueMap = dynamic(() => import("./issue-map"), { ssr: false, loading: MapFallback });
export const LocationPicker = dynamic(() => import("./location-picker"), { ssr: false, loading: MapFallback });
export const MiniMap = dynamic(() => import("./mini-map"), { ssr: false, loading: MapFallback });
export type { MapView } from "./issue-map";
