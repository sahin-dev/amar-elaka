import { describe, expect, it } from "vitest";
import { approximateLocation, distanceMeters, parseBBox } from "@/lib/geo";
import { getFreshness } from "@/lib/freshness";

describe("public coordinate privacy", () => {
  const home = { lat: 23.806789, lng: 90.368123 };

  it("never returns the exact point", () => {
    const a = approximateLocation(home);
    expect(a).not.toEqual(home);
  });

  it("stays within one grid cell (< ~120 m) of the exact point", () => {
    for (let i = 0; i < 500; i++) {
      const p = { lat: 22 + Math.random() * 4, lng: 88.5 + Math.random() * 3.5 };
      expect(distanceMeters(p, approximateLocation(p))).toBeLessThan(125);
    }
  });

  it("is deterministic: nearby points in the same cell map to the same public point", () => {
    const a = approximateLocation(home);
    const b = approximateLocation({ lat: home.lat + 0.0001, lng: home.lng - 0.0001 });
    expect(a).toEqual(b);
    // Repeated reports cannot be averaged to recover the exact point.
    const many = Array.from({ length: 20 }, () => approximateLocation(home));
    expect(new Set(many.map((m) => `${m.lat},${m.lng}`)).size).toBe(1);
  });
});

describe("bbox parsing", () => {
  it("parses valid boxes and rejects malformed ones", () => {
    expect(parseBBox("90.3,23.7,90.5,23.9")).toEqual({ minLng: 90.3, minLat: 23.7, maxLng: 90.5, maxLat: 23.9 });
    expect(parseBBox("90.5,23.7,90.3,23.9")).toBeNull();
    expect(parseBBox("a,b,c,d")).toBeNull();
    expect(parseBBox("1,2,3")).toBeNull();
    expect(parseBBox("0,-100,1,1")).toBeNull();
  });
});

describe("freshness labels", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  it("labels by age of last confirmation", () => {
    expect(getFreshness(hoursAgo(2), null, now)).toBe("recent");
    expect(getFreshness(hoursAgo(30), null, now)).toBe("check");
    expect(getFreshness(hoursAgo(80), null, now)).toBe("outdated");
  });

  it("a recent confirmation refreshes an old report", () => {
    expect(getFreshness(hoursAgo(200), hoursAgo(1), now)).toBe("recent");
  });

  it("respects configurable windows", () => {
    expect(getFreshness(hoursAgo(5), null, now, { recentHours: 4, checkHours: 8 })).toBe("check");
  });
});
