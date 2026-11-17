import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/app-config";
import { fmt, formatNumber, relativeTime } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { isDbConfigured } from "@/server/db";
import { getAreaBySlug, getAreaIssues, getAreaSummary } from "@/server/services/areas";
import { IssueCard } from "@/components/issues/issue-card";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ShareLinks } from "@/components/share/share-links";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isDbConfigured()) return {};
  const area = await getAreaBySlug(slug);
  const { locale, t } = await getI18n();
  if (!area) return { title: t.common.notFoundTitle };
  const s = await getAreaSummary(area);
  const name = area.name[locale];
  const description = `${formatNumber(s.unresolved, locale)} ${t.areas.unresolved.toLowerCase()} · ${formatNumber(s.resolvedRecent, locale)} ${t.areas.resolvedRecent.toLowerCase()}. ${t.disclaimer.community}`;
  return {
    title: `${name} — ${area.city[locale]}`,
    description,
    openGraph: { title: fmt(t.areas.shareText, { area: name }), description, type: "website" },
    alternates: { canonical: `/areas/${area.slug}` },
  };
}

export default async function AreaPage({ params }: Props) {
  if (!isDbConfigured()) return <SetupNotice />;
  const { slug } = await params;
  const area = await getAreaBySlug(slug);
  if (!area) notFound();
  const { locale, t } = await getI18n();
  const [summary, unresolved, resolved, recent] = await Promise.all([
    getAreaSummary(area),
    getAreaIssues(area, "unresolved", 8),
    getAreaIssues(area, "resolved", 5),
    getAreaIssues(area, "recent", 5),
  ]);
  const name = area.name[locale];
  const stat = (label: string, n: number, cls: string) => (
    <div className="card p-4">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold ${cls}`}>{formatNumber(n, locale)}</dd>
    </div>
  );
  const catCounts = CATEGORIES.map((c) => ({ c, n: summary.byCategory[c.id] ?? 0 })).filter((x) => x.n > 0);
  const maxCat = Math.max(1, ...catCounts.map((x) => x.n));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 to-brand-600 p-6 text-white md:p-8">
        <p className="flex items-center gap-1.5 text-sm text-white/80">
          <Icon name="pin" size={16} />
          {area.city[locale]}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{name}</h1>
        <p className="mt-2 text-sm text-white/85">
          {summary.lastUpdated ? fmt(t.areas.lastUpdated, { time: relativeTime(summary.lastUpdated, locale) }) : t.areas.noActivity}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink
            href={`/?bbox=${summary.area.bbox.join(",")}`}
            variant="secondary"
            size="sm"
            className="border-white/20 bg-white text-brand-800"
          >
            <Icon name="map" size={16} />
            {t.areas.viewOnMap}
          </ButtonLink>
          <ShareLinks path={`/areas/${area.slug}`} title={fmt(t.areas.shareText, { area: name })} />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat(t.areas.unresolved, summary.unresolved, "text-amber-800")}
        {stat(t.status.community_verified, summary.verified, "text-orange-800")}
        {stat(t.areas.resolvedRecent, summary.resolvedRecent, "text-green-800")}
        {stat(t.areas.total, summary.total, "text-ink")}
      </dl>

      {summary.total === 0 ? (
        <div className="card mt-6">
          <EmptyState title={t.areas.empty} action={<ButtonLink href="/report">{t.common.reportProblem}</ButtonLink>} />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <section className="card px-4 pb-1 pt-4" aria-labelledby="unres-h">
              <h2 id="unres-h" className="font-semibold">{t.areas.unresolvedIssues}</h2>
              {unresolved.length ? (
                <ul>{unresolved.map((i) => <li key={i.id}><IssueCard issue={i} locale={locale} /></li>)}</ul>
              ) : (
                <p className="py-4 text-sm text-ink-muted">{t.areas.empty}</p>
              )}
            </section>
            <section className="card px-4 pb-1 pt-4" aria-labelledby="recent-h">
              <h2 id="recent-h" className="font-semibold">{t.areas.recentIssues}</h2>
              <ul>{recent.map((i) => <li key={i.id}><IssueCard issue={i} locale={locale} /></li>)}</ul>
            </section>
            <section className="card px-4 pb-1 pt-4" aria-labelledby="res-h">
              <h2 id="res-h" className="font-semibold">{t.areas.resolvedIssues}</h2>
              <p className="text-xs text-ink-muted">{t.statusHelp.community_resolved}</p>
              {resolved.length ? (
                <ul>{resolved.map((i) => <li key={i.id}><IssueCard issue={i} locale={locale} /></li>)}</ul>
              ) : (
                <p className="py-4 text-sm text-ink-muted">—</p>
              )}
            </section>
          </div>
          <aside className="space-y-6">
            {catCounts.length > 0 && (
              <section className="card p-4" aria-labelledby="cat-h">
                <h2 id="cat-h" className="font-semibold">{t.areas.byCategory}</h2>
                <ul className="mt-3 space-y-2.5">
                  {catCounts.map(({ c, n }) => (
                    <li key={c.id}>
                      <div className="flex justify-between text-sm">
                        <span>{c.label[locale]}</span>
                        <span className="font-semibold">{formatNumber(n, locale)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-gray-100" aria-hidden="true">
                        <div className="h-2 rounded-full" style={{ width: `${(n / maxCat) * 100}%`, backgroundColor: c.color }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
      <p className="mt-6 text-xs text-ink-muted">
        {t.areas.approximateBoundary} {t.disclaimer.community}
      </p>
    </div>
  );
}
