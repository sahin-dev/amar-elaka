import { fmt, formatDateTime, getDictionary, relativeTime, type Locale } from "@/i18n";
import type { PublicIssueUpdate } from "@/lib/public-types";
import type { IssueStatus } from "@/config/app-config";
import { cn } from "@/lib/cn";

const DOT: Record<string, string> = {
  created: "bg-brand-600",
  confirmed_present: "bg-orange-500",
  reported_fixed: "bg-green-600",
  status_changed: "bg-ink",
  reopened: "bg-orange-600",
  archived: "bg-gray-500",
  under_review: "bg-violet-600",
};

/** Public update history. Shows who acted only as a role (community / moderator / system). */
export function Timeline({ updates, locale }: { updates: PublicIssueUpdate[]; locale: Locale }) {
  const t = getDictionary(locale);
  if (!updates.length) return <p className="text-sm text-ink-muted">{t.issue.noHistory}</p>;
  const label = (u: PublicIssueUpdate) => {
    const key = u.type as keyof typeof t.history;
    const base = t.history[key] ?? u.type;
    return u.type === "status_changed" && u.toStatus ? fmt(base, { status: t.status[u.toStatus as IssueStatus] }) : base;
  };
  const actor = { community: t.history.by_community, moderator: t.history.by_moderator, system: t.history.by_system };
  const items = [...updates].reverse();
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((u) => (
        <li key={u.id} className="relative">
          <span className={cn("absolute -left-[26px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white", DOT[u.type] ?? "bg-gray-400")} aria-hidden="true" />
          <p className="text-sm font-medium text-ink">{label(u)}</p>
          <p className="text-xs text-ink-muted">
            <time dateTime={u.createdAt} title={formatDateTime(u.createdAt, locale)} suppressHydrationWarning>
              {relativeTime(u.createdAt, locale)}
            </time>{" "}
            · {actor[u.actorKind]}
          </p>
        </li>
      ))}
    </ol>
  );
}
