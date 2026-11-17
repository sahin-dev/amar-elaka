import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTime, formatNumber, relativeTime } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { getCurrentUser, isModerator } from "@/server/auth/session";
import { isDbConfigured } from "@/server/db";
import { getModerationQueues, listAuditLog } from "@/server/services/moderation";
import { CategoryLabel, StatusBadge } from "@/components/issues/badges";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { PhotoReview } from "@/components/moderation/photo-review";
import { EmptyState, Notice } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.moderation.title, robots: { index: false, follow: false } };
}

const TABS = ["pending", "flagged", "duplicates", "review", "photos", "audit"] as const;
type Tab = (typeof TABS)[number];

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!isDbConfigured()) return <SetupNotice />;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/moderation");
  const { locale, t } = await getI18n();
  if (!isModerator(user)) {
    return (
      <PageShell title={t.moderation.title}>
        <Notice tone="danger">{t.moderation.forbidden}</Notice>
      </PageShell>
    );
  }
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "pending";
  const q = await getModerationQueues(user);
  const audit = tab === "audit" ? await listAuditLog(user, 100) : [];

  const labels: Record<Tab, string> = {
    pending: t.moderation.queuePending,
    flagged: t.moderation.queueFlags,
    duplicates: t.moderation.queueDuplicates,
    review: t.moderation.queueReview,
    photos: t.moderation.queuePhotos,
    audit: t.moderation.auditLog,
  };
  const count: Record<Tab, number | null> = {
    pending: q.pending.length,
    flagged: q.flagged.length,
    duplicates: q.duplicates.length,
    review: q.review.length,
    photos: q.photos.length,
    audit: null,
  };
  const rows = tab === "photos" || tab === "audit" ? [] : q[tab];

  return (
    <PageShell title={t.moderation.title} intro={t.moderation.intro} width="xl">
      <nav aria-label={t.moderation.title} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2">
        {TABS.map((k) => (
          <Link
            key={k}
            href={`/moderation?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium",
              tab === k ? "bg-ink text-white" : "border border-line bg-white text-ink-soft hover:bg-canvas",
            )}
          >
            {labels[k]}
            {count[k] !== null && (
              <span className={cn("rounded-full px-1.5 text-xs", tab === k ? "bg-white/20" : "bg-gray-100")}>{formatNumber(count[k]!, locale)}</span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {tab === "photos" ? (
          q.photos.length === 0 ? (
            <div className="card"><EmptyState icon="checkCircle" title={t.moderation.empty} /></div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {q.photos.map((p) => (
                <li key={p.id} className="card overflow-hidden">
                  {/* Served only to moderators while pending */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photos/${p.id}`} alt="" className="h-48 w-full bg-canvas object-contain" loading="lazy" />
                  <div className="space-y-3 p-3">
                    <Link href={`/moderation/issues/${p.issueId}`} className="text-sm font-medium text-brand-700 underline">
                      {t.moderation.open} →
                    </Link>
                    <PhotoReview photoId={p.id} />
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : tab === "audit" ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">{t.moderation.auditLog}</caption>
              <thead className="border-b border-line bg-canvas text-xs uppercase text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Time</th>
                  <th scope="col" className="px-3 py-2">Action</th>
                  <th scope="col" className="px-3 py-2">From → To</th>
                  <th scope="col" className="px-3 py-2">Actor</th>
                  <th scope="col" className="px-3 py-2">Report</th>
                  <th scope="col" className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTime(e.createdAt, locale)}</td>
                    <td className="px-3 py-2 font-medium">{e.action}</td>
                    <td className="px-3 py-2 text-ink-muted">{e.from ?? "—"} → {e.to ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.actor}</td>
                    <td className="px-3 py-2">
                      {e.issueId ? <Link href={`/moderation/issues/${e.issueId}`} className="font-mono text-xs text-brand-700 underline">{e.issueId.slice(0, 8)}</Link> : "—"}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-ink-muted" title={e.note}>{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {audit.length === 0 && <EmptyState icon="list" title={t.moderation.empty} />}
          </div>
        ) : rows.length === 0 ? (
          <div className="card"><EmptyState icon="checkCircle" title={t.moderation.empty} /></div>
        ) : (
          <ul className="card divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <CategoryLabel category={r.category} locale={locale} />
                    {r.area && <span className="text-ink-muted">· {r.area.name[locale]}</span>}
                    <span className="text-ink-muted" suppressHydrationWarning>· {relativeTime(r.createdAt, locale)}</span>
                  </div>
                  <p className="mt-0.5 truncate font-medium">{r.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    <StatusBadge status={r.status} locale={locale} />
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">{t.modState[r.moderationState]}</span>
                    {r.openFlags > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-800">{t.moderation.flags}: {r.openFlags}</span>}
                    {r.duplicateCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{t.moderation.possibleDuplicates}: {r.duplicateCount}</span>}
                  </div>
                </div>
                <Link href={`/moderation/issues/${r.id}`} className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-medium text-white hover:bg-black">
                  {t.moderation.open}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
