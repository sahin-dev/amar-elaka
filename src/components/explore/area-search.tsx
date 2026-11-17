"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export interface AreaHit {
  slug: string;
  name: { en: string; bn: string };
  city: { en: string; bn: string };
  bbox: [number, number, number, number];
}

/** Accessible combobox for jumping the map to a named area. */
export function AreaSearch({ onPick }: { onPick: (a: AreaHit) => void }) {
  const { locale, t } = useI18n();
  const id = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AreaHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/areas?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const body = await res.json();
        setHits(body.areas ?? []);
        setSearched(true);
        setActive(-1);
      } catch {
        /* ignore: aborted or offline */
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(a: AreaHit) {
    onPick(a);
    setQ(a.name[locale]);
    setOpen(false);
  }

  const listId = `${id}-list`;
  const showList = open && q.trim().length >= 2 && (hits.length > 0 || searched);

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={`${id}-input`} className="sr-only">
        {t.explore.searchAreaLabel}
      </label>
      <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        value={q}
        placeholder={t.explore.searchArea}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits.length) {
            e.preventDefault();
            pick(hits[Math.max(active, 0)]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 text-[15px] placeholder:text-ink-faint focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-[1200] mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lg">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">{t.explore.noAreaFound}</li>
          ) : (
            hits.map((a, i) => (
              <li
                key={a.slug}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(a)}
                className={cn("flex cursor-pointer items-center gap-2 px-3 py-2 text-sm", i === active ? "bg-brand-50" : "hover:bg-canvas")}
              >
                <Icon name="pin" size={16} className="text-brand-700" />
                <span className="font-medium">{a.name[locale]}</span>
                <span className="text-ink-muted">· {a.city[locale]}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
