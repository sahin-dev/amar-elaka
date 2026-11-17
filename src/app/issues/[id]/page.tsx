import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory } from "@/config/app-config";
import { fmt, formatDateTime, relativeTime } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { uuidSchema } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";
import { isDbConfigured } from "@/server/db";
import { getIssueForViewer, getIssueHistory } from "@/server/services/issues";
import { CategoryIcon, CategoryLabel, FreshnessBadge, StatusBadge } from "@/components/issues/badges";
import { ClientMiniMap } from "@/components/issues/client-mini-map";
import { Timeline } from "@/components/issues/timeline";
import { VoteActions } from "@/components/issues/vote-actions";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ShareButton } from "@/components/share/share-button";
import { Icon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/states";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!uuidSchema.safeParse(id).success || !isDbConfigured()) return null;
  return getIssueForViewer(id, await getCurrentUser());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const issue = await load(id);
  const { locale, t } = await getI18n();
  if (!issue || issue.notPublic) return { title: t.common.notFoundTitle, robots: { index: false } };
  const cat = getCategory(issue.category).label[locale];
  const desc = `${t.status[issue.status]} · ${cat}${issue.area ? ` · ${issue.area.name[locale]}` : ""}. ${t.disclaimer.community}`;
  return {
    title: issue.title,
    description: desc,
    openGraph: {
      title: fmt(t.issue.shareTitle, { title: issue.title }),
      description: desc,
      type: "article",
      ...(issue.photoId ? { images: [{ url: `/api/photos/${issue.photoId}`, alt: issue.title }] } : {}),
    },
    alternates: { canonical: `/issues/${issue.id}` },
  };
}

export default async function IssuePage({ params }: Props) {
  if (!isDbConfigured()) return <SetupNotice />;
  const { id } = await params;
  const user = await getCurrentUser();
  const issue = await load(id);
  if (!issue) notFound();
  const { locale, t } = await getI18n();
  const history = await getIssueHistory(issue.id);
  const cat = getCategory(issue.category);
  const isMod = user?.role === "moderator" || user?.role === "admin";
  const canVote = !issue.notPublic && !issue.mergedInto && issue.status !== "archived";

  return (
    <div className="mx-auto max-w-5xl pb-10 md:px-6 md:pt-8">
      {/* Hero */}
      <div className="relative">
        {issue.photoId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/photos/${issue.photoId}`} alt={issue.title} className="h-60 w-full object-cover md:h-80 md:rounded-2xl" decoding="async" />
        ) : (
          <div className="flex h-36 w-full items-center justify-center md:h-44 md:rounded-2xl" style={{ backgroundColor: `${cat.color}14` }}>
            <CategoryIcon category={issue.category} size={64} />
          </div>
        )}
        <div className="absolute left-3 right-3 top-3 flex justify-between md:left-4 md:right-4">
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow" aria-label={t.common.back}>
            <Icon name="chevronLeft" />
          </Link>
          {!issue.notPublic && (
            <ShareButton path={`/issues/${issue.id}`} title={issue.title} variant="button" className="h-10 rounded-full bg-white/90 shadow" />
          )}
        </div>
      </div>

      <div className="grid gap-6 px-4 pt-5 md:grid-cols-[1fr_340px] md:px-0">
        {/* Mobile order: details → actions → history. Desktop: actions in a sticky right column. */}
        <div className="min-w-0 space-y-5 md:col-start-1 md:row-start-1">
          {issue.notPublic && <Notice tone="warn">{t.report.successPending}</Notice>}
          {issue.mergedInto && (
            <Notice tone="info" title={t.issue.mergedNotice}>
              <Link href={`/issues/${issue.mergedInto}`} className="font-semibold underline">
                {t.issue.seeMerged}
              </Link>
            </Notice>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <CategoryLabel category={issue.category} locale={locale} />
              {issue.area && (
                <>
                  <span className="text-ink-faint" aria-hidden="true">·</span>
                  <Link href={`/areas/${issue.area.slug}`} className="font-medium text-brand-700 hover:underline">
                    {issue.area.name[locale]}
                  </Link>
                </>
              )}
            </div>
            <h1 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight md:text-3xl">{issue.title}</h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge status={issue.status} locale={locale} />
              {issue.status !== "community_resolved" && issue.status !== "archived" && <FreshnessBadge freshness={issue.freshness} locale={locale} />}
            </div>
            {(issue.status === "reported" || issue.status === "community_verified") && (
              <p className="mt-2 text-sm text-ink-muted">{t.statusHelp[issue.status]}</p>
            )}
          </div>

          {issue.status === "community_resolved" && <Notice tone="success">{t.issue.resolvedNotice}</Notice>}
          {issue.status === "under_review" && <Notice tone="info">{t.issue.underReviewNotice}</Notice>}
          {issue.status === "archived" && <Notice tone="neutral">{t.issue.archivedNotice}</Notice>}

          {issue.description && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{issue.description}</p>}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="card p-3">
              <dt className="text-xs text-ink-muted">{fmt(t.issue.reported, { time: "" }).trim()}</dt>
              <dd className="mt-0.5 font-medium">
                <time dateTime={issue.createdAt} title={formatDateTime(issue.createdAt, locale)} suppressHydrationWarning>
                  {relativeTime(issue.createdAt, locale)}
                </time>
              </dd>
            </div>
            <div className="card p-3">
              <dt className="text-xs text-ink-muted">{fmt(t.issue.lastConfirmed, { time: "" }).trim()}</dt>
              <dd className="mt-0.5 font-medium">
                {issue.lastConfirmedAt ? (
                  <time dateTime={issue.lastConfirmedAt} title={formatDateTime(issue.lastConfirmedAt, locale)} suppressHydrationWarning>
                    {relativeTime(issue.lastConfirmedAt, locale)}
                  </time>
                ) : (
                  <span className="font-normal text-ink-muted">{t.issue.neverConfirmed}</span>
                )}
              </dd>
            </div>
          </dl>

          {issue.photoPending && <Notice tone="neutral">{t.issue.photoPending}</Notice>}

          <section aria-labelledby="loc-h">
            <h2 id="loc-h" className="text-base font-semibold">{t.issue.approxLocation}</h2>
            <div className="mt-2 h-48 overflow-hidden rounded-2xl border border-line md:h-56">
              <ClientMiniMap lat={issue.lat} lng={issue.lng} category={issue.category} ariaLabel={`${t.issue.approxLocation}: ${t.issue.approxLocationNote}`} />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">{t.issue.approxLocationNote}</p>
          </section>

        </div>

        <aside className="space-y-4 md:col-start-2 md:row-span-2 md:row-start-1">
          <section className="card p-4 md:sticky md:top-24" aria-labelledby="act-h">
            <h2 id="act-h" className="font-semibold">{t.issue.actionsTitle}</h2>
            <p className="mb-4 mt-1 text-sm text-ink-muted">{t.issue.actionsHint}</p>
            <VoteActions issueId={issue.id} presentCount={issue.presentCount} fixedCount={issue.fixedCount} signedIn={!!user} emailVerified={!!user?.emailVerified} canVote={canVote} />
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">{t.issue.communityNotice}</p>
            <p className="mt-1 text-xs font-medium text-red-800">{t.disclaimer.emergency}</p>
            {isMod && (
              <Link href={`/moderation/issues/${issue.id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-violet-800 hover:underline">
                <Icon name="shield" size={16} />
                {t.common.moderation}
              </Link>
            )}
          </section>
          <p className="px-1 text-xs text-ink-faint">
            {t.issue.reportId}: <span className="font-mono">{issue.id.slice(0, 8)}</span>
          </p>
        </aside>

        <section aria-labelledby="hist-h" className="min-w-0 md:col-start-1 md:row-start-2">
          <h2 id="hist-h" className="text-base font-semibold">{t.issue.history}</h2>
          <div className="mt-3">
            <Timeline updates={history} locale={locale} />
          </div>
        </section>
      </div>
    </div>
  );
}
