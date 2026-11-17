import { getCategory, type IssueStatus } from "@/config/app-config";
import { getDictionary, type Locale } from "@/i18n";
import type { Freshness } from "@/lib/freshness";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icons";

const STATUS_STYLE: Record<IssueStatus, string> = {
  reported: "bg-amber-50 text-amber-800 ring-amber-200",
  community_verified: "bg-orange-50 text-orange-800 ring-orange-200",
  under_review: "bg-violet-50 text-violet-800 ring-violet-200",
  community_resolved: "bg-green-50 text-green-800 ring-green-200",
  archived: "bg-gray-100 text-gray-700 ring-gray-200",
};

export function StatusBadge({ status, locale, className }: { status: IssueStatus; locale: Locale; className?: string }) {
  const t = getDictionary(locale);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLE[status],
        className,
      )}
    >
      {status === "community_resolved" && <Icon name="check" size={12} />}
      {t.status[status]}
    </span>
  );
}

const FRESH_STYLE: Record<Freshness, string> = {
  recent: "text-brand-800 bg-brand-50",
  check: "text-amber-800 bg-amber-50",
  outdated: "text-gray-700 bg-gray-100",
};

export function FreshnessBadge({ freshness, locale }: { freshness: Freshness; locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", FRESH_STYLE[freshness])}>
      <Icon name="clock" size={12} />
      {t.freshness[freshness]}
    </span>
  );
}

export function CategoryIcon({ category, size = 36 }: { category: string; size?: number }) {
  const c = getCategory(category);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ backgroundColor: c.color, width: size, height: size }}
      aria-hidden="true"
    >
      <Icon name={c.icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

export function CategoryLabel({ category, locale, className }: { category: string; locale: Locale; className?: string }) {
  const c = getCategory(category);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)} style={{ color: c.color }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
      {c.label[locale]}
    </span>
  );
}
