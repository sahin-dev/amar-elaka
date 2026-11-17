import type { Metadata } from "next";
import Link from "next/link";
import { formatNumber } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { isDbConfigured, getCollections } from "@/server/db";
import { listAreas, PUBLIC_ISSUE_FILTER } from "@/server/services/areas";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { EmptyState } from "@/components/ui/states";
import { Icon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.areas.title, description: t.areas.intro };
}

export default async function AreasPage() {
  if (!isDbConfigured()) return <SetupNotice />;
  const { locale, t } = await getI18n();
  const areas = await listAreas();
  const { issues } = await getCollections();
  const counts = await issues
    .aggregate<{ _id: string; n: number }>([
      { $match: { ...PUBLIC_ISSUE_FILTER, status: { $in: ["reported", "community_verified", "under_review"] }, areaId: { $ne: null } } },
      { $group: { _id: "$areaId", n: { $sum: 1 } } },
    ])
    .toArray();
  const byArea = new Map(counts.map((c) => [c._id, c.n]));
  const cities = [...new Set(areas.map((a) => a.city[locale]))];

  return (
    <PageShell title={t.areas.title} intro={t.areas.intro} width="lg">
      {areas.length === 0 ? (
        <EmptyState icon="grid" title={t.areas.noActivity} body="Run `npm run db:seed:areas` to load neighbourhood boundaries." />
      ) : (
        <div className="space-y-8">
          {cities.map((city) => (
            <section key={city} aria-labelledby={`city-${city}`}>
              <h2 id={`city-${city}`} className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {city}
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {areas
                  .filter((a) => a.city[locale] === city)
                  .map((a) => {
                    const n = byArea.get(a._id) ?? 0;
                    return (
                      <li key={a._id}>
                        <Link href={`/areas/${a.slug}`} className="card flex items-center gap-3 p-4 hover:border-brand-300">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
                            <Icon name="pin" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{a.name[locale]}</span>
                            <span className="text-sm text-ink-muted">
                              {formatNumber(n, locale)} {t.areas.unresolved.toLowerCase()}
                            </span>
                          </span>
                          <Icon name="chevronRight" className="text-ink-faint" />
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
          <p className="text-xs text-ink-muted">{t.areas.approximateBoundary}</p>
        </div>
      )}
    </PageShell>
  );
}
