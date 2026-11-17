import Link from "next/link";
import { fmt, formatNumber, getDictionary, relativeTime, type Locale } from "@/i18n";
import { distanceMeters, formatDistance, type LatLng } from "@/lib/geo";
import type { PublicIssueSummary } from "@/lib/public-types";
import { cn } from "@/lib/cn";
import { ShareButton } from "@/components/share/share-button";
import { Icon } from "@/components/ui/icons";
import { CategoryIcon, CategoryLabel, FreshnessBadge, StatusBadge } from "./badges";

/**
 * List card modelled on the "Latest in the area" design: location meta line,
 * title, two-line excerpt, update time + confirmations + share, thumbnail.
 * The whole card is clickable via a stretched link; Share stays independently focusable.
 */
export function IssueCard({
  issue,
  locale,
  from,
  selected,
  onFocusIssue,
  headingLevel = 3,
}: {
  issue: PublicIssueSummary;
  locale: Locale;
  from?: LatLng | null;
  selected?: boolean;
  onFocusIssue?: (id: string) => void;
  headingLevel?: 2 | 3;
}) {
  const t = getDictionary(locale);
  const H = headingLevel === 2 ? "h2" : "h3";
  const isNew = Date.now() - new Date(issue.createdAt).getTime() < 24 * 3_600_000;
  const meta = [
    from ? formatDistance(distanceMeters(from, issue), locale) : null,
    issue.area ? issue.area.name[locale] : null,
  ].filter(Boolean);

  return (
    <article
      className={cn(
        "relative flex gap-3 border-b border-line px-1 py-4 transition-colors last:border-b-0 hover:bg-brand-50/40",
        selected && "bg-brand-50/60",
      )}
      onMouseEnter={onFocusIssue ? () => onFocusIssue(issue.id) : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          {meta.length > 0 && <span className="font-medium text-brand-700">{meta.join(" · ")}</span>}
          {isNew && (
            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-brand-800">{t.explore.newBadge}</span>
          )}
          {!meta.length && <CategoryLabel category={issue.category} locale={locale} />}
        </div>
        <H className="mt-1 text-[15px] font-semibold leading-snug text-ink">
          <Link href={`/issues/${issue.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-brand-600">
            {issue.title}
          </Link>
        </H>
        {issue.excerpt && <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{issue.excerpt}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={issue.status} locale={locale} />
          {issue.status !== "community_resolved" && issue.status !== "archived" && <FreshnessBadge freshness={issue.freshness} locale={locale} />}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
          <time dateTime={issue.lastActivityAt} suppressHydrationWarning>
            {fmt(t.explore.updated, { time: relativeTime(issue.lastActivityAt, locale) })}
          </time>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Icon name="checkCircle" size={13} />
            {fmt(t.explore.confirmed, { n: formatNumber(issue.presentCount, locale) })}
          </span>
          <span aria-hidden="true">·</span>
          <ShareButton path={`/issues/${issue.id}`} title={issue.title} />
        </div>
      </div>
      <div className="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-canvas">
        {issue.photoId ? (
          // Plain <img>: photos are already resized server-side; avoids paid image-optimisation quotas.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/photos/${issue.photoId}?v=thumb`} alt="" width={84} height={84} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <CategoryIcon category={issue.category} size={40} />
          </div>
        )}
      </div>
    </article>
  );
}
