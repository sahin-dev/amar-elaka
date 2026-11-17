/**
 * Map tile configuration (public, read at build time).
 * Any OpenStreetMap-compatible raster XYZ provider works. The public OSM
 * tile server is acceptable for light development use only; production
 * traffic needs a provider plan or self-hosted tiles. See docs/SERVICES_AND_COSTS.md.
 */
export const MAP_CONFIG = {
  tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: Number(process.env.NEXT_PUBLIC_MAP_MAX_ZOOM || 19),
};
