"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_CONFIG, CATEGORIES, type CategoryId } from "@/config/app-config";
import { fmt, formatNumber } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { IssueListResponse, MapMarker, PublicIssueSummary, StatusSummary } from "@/lib/public-types";
import { cn } from "@/lib/cn";
import { IssueMap, type MapView } from "@/components/map";
import { IssueCard } from "@/components/issues/issue-card";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { EmptyState, ErrorState, IssueCardSkeleton } from "@/components/ui/states";
import { AreaSearch, type AreaHit } from "./area-search";

type StatusFilter = "open" | "resolved" | "all";
const STATUS_PARAM: Record<StatusFilter, string> = {
  open: "reported,community_verified,under_review",
  resolved: "community_resolved",
  all: "",
};

export interface ExploreInitial {
  center: { lat: number; lng: number };
  zoom: number;
  bbox: [number, number, number, number] | null;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  return body as T;
}

export function ExploreView({ initial }: { initial: ExploreInitial }) {
  const { locale, t } = useI18n();
  const [view, setView] = useState<MapView | null>(null);
  const [categories, setCategories] = useState<CategoryId[]>([]);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [items, setItems] = useState<PublicIssueSummary[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [summary, setSummary] = useState<StatusSummary | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileMode, setMobileMode] = useState<"map" | "list">("map");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [fit, setFit] = useState<{ key: string; bbox: [number, number, number, number] } | null>(
    initial.bbox ? { key: "initial", bbox: initial.bbox } : null,
  );
  const [fly, setFly] = useState<{ key: string; lat: number; lng: number; zoom?: number } | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  const query = useMemo(() => {
    if (!view) return null;
    const p = new URLSearchParams();
    p.set("bbox", view.bbox.join(","));
    if (categories.length) p.set("category", categories.join(","));
    if (STATUS_PARAM[status]) p.set("status", STATUS_PARAM[status]);
    return p;
  }, [view, categories, status]);

  // Load list + markers when the view or filters change (debounced; aborts stale requests).
  useEffect(() => {
    if (!query) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const listQ = new URLSearchParams(query);
        listQ.set("summary", "1");
        listQ.set("limit", String(APP_CONFIG.pagination.pageSize));
        const [list, mk] = await Promise.all([
          getJson<IssueListResponse>(`/api/issues?${listQ}`, ctrl.signal),
          getJson<{ markers: MapMarker[] }>(`/api/issues/markers?${query}`, ctrl.signal),
        ]);
        setItems(list.items);
        setHasMore(list.hasMore);
        setPage(1);
        setSummary(list.summary ?? null);
        setMarkers(mk.markers);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(navigator.onLine ? (e as Error).message || t.explore.loadError : t.common.errorNetwork);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, retryTick, t]);

  // Keep the current view in the URL so it can be shared/bookmarked.
  useEffect(() => {
    if (!view) return;
    const url = new URL(window.location.href);
    url.searchParams.set("lat", view.center.lat.toFixed(5));
    url.searchParams.set("lng", view.center.lng.toFixed(5));
    url.searchParams.set("z", String(view.zoom));
    url.searchParams.delete("bbox");
    window.history.replaceState(null, "", url.toString());
  }, [view]);

  const loadMore = useCallback(async () => {
    if (!query) return;
    setLoadingMore(true);
    try {
      const q = new URLSearchParams(query);
      q.set("page", String(page + 1));
      q.set("limit", String(APP_CONFIG.pagination.pageSize));
      const ctrl = new AbortController();
      const list = await getJson<IssueListResponse>(`/api/issues?${q}`, ctrl.signal);
      setItems((prev) => [...prev, ...list.items.filter((i) => !prev.some((p) => p.id === i.id))]);
      setHasMore(list.hasMore);
      setPage(list.page);
    } catch {
      setError(t.explore.loadError);
    } finally {
      setLoadingMore(false);
    }
  }, [query, page, t]);

  function toggleCategory(id: CategoryId) {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocError(t.common.locationDenied);
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(p);
        setFly({ key: String(Date.now()), ...p, zoom: 15 });
        setLocating(false);
      },
      () => {
        setLocError(t.common.locationDenied);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  function onPickArea(a: AreaHit) {
    setFit({ key: `${a.slug}-${Date.now()}`, bbox: a.bbox });
  }

  function onSelectMarker(id: string) {
    setSelectedId(id);
    const el = document.getElementById(`issue-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const distanceFrom = userLoc ?? view?.center ?? null;

  const filters = (
    <div className="space-y-3">
      <AreaSearch onPick={onPickArea} />
      <div role="group" aria-label={t.explore.filters} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {CATEGORIES.map((c) => {
          const on = categories.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleCategory(c.id)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                on ? "border-transparent text-white" : "border-line bg-white text-ink-soft hover:bg-canvas",
              )}
              style={on ? { backgroundColor: c.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? "#fff" : c.color }} aria-hidden="true" />
              {c.label[locale]}
            </button>
          );
        })}
      </div>
      <div role="radiogroup" aria-label={t.explore.statusFilter} className="inline-flex rounded-xl border border-line bg-white p-0.5 text-[13px]">
        {(["open", "resolved", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            onClick={() => setStatus(s)}
            className={cn("rounded-lg px-3 py-1.5 font-medium", status === s ? "bg-brand-700 text-white" : "text-ink-soft hover:bg-canvas")}
          >
            {s === "open" ? t.explore.openOnly : s === "resolved" ? t.explore.resolvedOnly : t.common.all}
          </button>
        ))}
      </div>
    </div>
  );

  const summaryBar = summary && (
    <dl className="grid grid-cols-3 gap-2 text-center" aria-label={t.explore.summaryTitle}>
      {[
        { label: t.explore.summaryOpen, n: summary.open, cls: "text-amber-800" },
        { label: t.explore.summaryVerified, n: summary.verified, cls: "text-orange-800" },
        { label: t.explore.summaryResolved, n: summary.resolved, cls: "text-green-800" },
      ].map((s) => (
        <div key={s.label} className="rounded-xl border border-line bg-white px-2 py-2">
          <dt className="text-[11px] text-ink-muted">{s.label}</dt>
          <dd className={cn("text-lg font-bold", s.cls)}>{formatNumber(s.n, locale)}</dd>
        </div>
      ))}
    </dl>
  );

  const list = (
    <div ref={listRef} aria-busy={loading}>
      {error ? (
        <ErrorState message={error} onRetry={() => setRetryTick((n) => n + 1)} retryLabel={t.common.retry} />
      ) : loading && items.length === 0 ? (
        <>
          <IssueCardSkeleton />
          <IssueCardSkeleton />
          <IssueCardSkeleton />
        </>
      ) : items.length === 0 ? (
        <EmptyState
          icon="map"
          title={t.explore.noIssues}
          body={t.explore.noIssuesHint}
          action={
            <ButtonLink href="/report" size="sm">
              <Icon name="plus" size={16} />
              {t.common.reportProblem}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {fmt(t.explore.showing, { n: items.length })}
          </p>
          <ul>
            {items.map((i) => (
              <li key={i.id} id={`issue-${i.id}`}>
                <IssueCard issue={i} locale={locale} from={distanceFrom} selected={i.id === selectedId} onFocusIssue={setSelectedId} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="py-4 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium hover:bg-canvas disabled:opacity-60"
              >
                {loadingMore ? t.common.loading : t.explore.loadMore}
              </button>
            </div>
          )}
        </>
      )}
      <p className="px-1 py-3 text-xs text-ink-faint">{t.explore.approximateNote} {t.disclaimer.short}.</p>
    </div>
  );

  const map = (
    <IssueMap
      markers={markers}
      initialCenter={initial.center}
      initialZoom={initial.zoom}
      fitBounds={fit}
      flyTo={fly}
      selectedId={selectedId}
      onSelect={onSelectMarker}
      onViewChange={setView}
      ariaLabel={t.explore.mapLabel}
      className="h-full w-full"
    />
  );

  const locateBtn = (
    <button
      type="button"
      onClick={locate}
      disabled={locating}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium text-ink shadow-card hover:bg-canvas disabled:opacity-60"
    >
      <Icon name="locate" size={18} />
      {locating ? t.common.locating : t.common.useMyLocation}
    </button>
  );

  if (isDesktop === null) {
    return <div className="h-[calc(100dvh-3.5rem-4rem)] md:h-[calc(100dvh-4rem)]" aria-busy="true" />;
  }

  if (isDesktop) {
    return (
      <div className="flex h-[calc(100dvh-4rem)]">
        <aside className="flex w-[420px] shrink-0 flex-col border-r border-line bg-white lg:w-[460px]">
          <div className="space-y-4 border-b border-line p-5">
            <h1 className="text-xl font-bold tracking-tight">{t.explore.latestInArea}</h1>
            {filters}
            {summaryBar}
          </div>
          <div className="flex-1 overflow-y-auto px-4">{list}</div>
        </aside>
        <div className="relative flex-1">
          {map}
          <div className="absolute right-4 top-4 z-[500]">{locateBtn}</div>
          {locError && (
            <p role="status" className="absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-sm shadow">
              {locError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Mobile: compact header, then either the map with a bottom sheet or a full list.
  return (
    <div className="flex h-[calc(100dvh-3.5rem-4rem-env(safe-area-inset-bottom))] flex-col">
      <div className="shrink-0 space-y-3 border-b border-line bg-white px-4 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold tracking-tight">{t.explore.title}</h1>
          <div role="tablist" aria-label={`${t.common.map} / ${t.common.list}`} className="inline-flex rounded-full border border-line bg-canvas p-0.5">
            {(["map", "list"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mobileMode === m}
                onClick={() => setMobileMode(m)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium",
                  mobileMode === m ? "bg-white text-ink shadow-card" : "text-ink-muted",
                )}
              >
                <Icon name={m === "map" ? "map" : "list"} size={16} />
                {m === "map" ? t.common.map : t.common.list}
              </button>
            ))}
          </div>
        </div>
        {filters}
      </div>

      <div className={cn("relative min-h-0 flex-1", mobileMode === "list" && "hidden")}>
        {map}
        <div className="absolute right-3 top-3 z-[500]">{locateBtn}</div>
        {locError && (
          <p role="status" className="absolute inset-x-3 top-16 z-[500] rounded-lg bg-white px-3 py-2 text-sm shadow">
            {locError}
          </p>
        )}
        <section
          aria-label={t.explore.latestInArea}
          className="absolute inset-x-0 bottom-0 z-[600] max-h-[48%] overflow-y-auto rounded-t-3xl bg-white px-4 pb-4 shadow-sheet"
        >
          <div className="sticky top-0 z-10 -mx-4 bg-white px-4 pb-2 pt-2">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" aria-hidden="true" />
            <div className="mt-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t.explore.latestInArea}</h2>
              <button type="button" onClick={() => setMobileMode("list")} className="text-sm font-medium text-brand-700">
                {t.explore.viewList}
              </button>
            </div>
          </div>
          {list}
        </section>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 pt-4", mobileMode === "map" && "hidden")}>
        {summaryBar}
        <div className="mt-2">{list}</div>
      </div>
    </div>
  );
}

function useIsDesktop(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setV(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return v;
}
