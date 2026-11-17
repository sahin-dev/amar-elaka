import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDateTime, relativeTime } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { planModerationAction } from "@/lib/moderation-rules";
import { MODERATION_ACTIONS, uuidSchema } from "@/lib/validation";
import { getCurrentUser, isModerator } from "@/server/auth/session";
import { isDbConfigured } from "@/server/db";
import { getIssueHistory } from "@/server/services/issues";
import { getModerationIssue } from "@/server/services/moderation";
import { CategoryLabel, StatusBadge } from "@/components/issues/badges";
import { Timeline } from "@/components/issues/timeline";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ModerationActions } from "@/components/moderation/moderation-actions";
import { PhotoReview } from "@/components/moderation/photo-review";
import { Notice } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ModerationIssuePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isDbConfigured()) return <SetupNotice />;
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/moderation/issues/${id}`);
  const { locale, t } = await getI18n();
  if (!isModerator(user)) {
    return (
      <PageShell title={t.moderation.title}>
        <Notice tone="danger">{t.moderation.forbidden}</Notice>
      </PageShell>
    );
  }
  if (!uuidSchema.safeParse(id).success) notFound();
  const data = await getModerationIssue(user, id);
  if (!data) notFound();
  const history = await getIssueHistory(id);
  const { issue } = data;

  // Only offer actions that the transition rules allow from the current state.
  const available = MODERATION_ACTIONS.filter(
    (a) =>
      planModerationAction(
        { status: issue.status, moderationState: data.moderationState, previousStatus: data.previousStatus, openFlags: data.openFlags },
        a,
      ).ok,
  );

  return (
    <PageShell
      title={issue.title}
      width="lg"
      intro={
        <div className="flex flex-wrap items-center gap-2">
          <CategoryLabel category={issue.category} locale={locale} />
          <StatusBadge status={issue.status} locale={locale} />
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{t.modState[data.moderationState]}</span>
          <Link href={`/issues/${issue.id}`} className="text-sm text-brand-700 underline">
            /issues/{issue.id.slice(0, 8)}
          </Link>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-5">
            <p className="whitespace-pre-line text-[15px] text-ink-soft">{issue.description || "—"}</p>
            <p className="mt-3 text-xs text-ink-muted">
              {formatDateTime(issue.createdAt, locale)} · round {data.round} · present {issue.presentCount} · fixed {issue.fixedCount}
            </p>
          </section>

          <section className="card p-5" aria-labelledby="priv-h">
            <h2 id="priv-h" className="font-semibold text-violet-900">{t.moderation.privateData}</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">{t.moderation.exactLocation}</dt>
                <dd className="font-mono">
                  {data.private.exactLocation ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${data.private.exactLocation.lat}&mlon=${data.private.exactLocation.lng}#map=18/${data.private.exactLocation.lat}/${data.private.exactLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 underline"
                    >
                      {data.private.exactLocation.lat.toFixed(5)}, {data.private.exactLocation.lng.toFixed(5)}
                    </a>
                  ) : (
                    <span className="font-sans text-ink-muted">{t.moderation.exactLocationExpired}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{t.moderation.reporterRef}</dt>
                <dd className="font-mono">{data.private.reporterRef ?? "—"} / ip {data.private.reporterIpRef ?? "—"}</dd>
              </div>
            </dl>
          </section>

          {data.photos.length > 0 && (
            <section className="card p-5" aria-labelledby="ph-h">
              <h2 id="ph-h" className="font-semibold">{t.moderation.photos}</h2>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {data.photos.map((p) => (
                  <li key={p.id} className="space-y-2">
                    {p.state !== "rejected" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/photos/${p.id}`} alt="" className="h-44 w-full rounded-xl bg-canvas object-contain" loading="lazy" />
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-xl bg-canvas text-sm text-ink-muted">rejected (deleted)</div>
                    )}
                    <p className="text-xs text-ink-muted">{p.state}</p>
                    {p.state === "pending" && <PhotoReview photoId={p.id} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.duplicates.length > 0 && (
            <section className="card p-5" aria-labelledby="dup-h">
              <h2 id="dup-h" className="font-semibold">{t.moderation.possibleDuplicates}</h2>
              <ul className="mt-2 divide-y divide-line text-sm">
                {data.duplicates.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Link href={`/moderation/issues/${d.id}`} className="flex-1 font-medium hover:underline">{d.title}</Link>
                    <code className="rounded bg-canvas px-1.5 text-xs">{d.id}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5" aria-labelledby="fl-h">
            <h2 id="fl-h" className="font-semibold">{t.moderation.flags} ({data.flags.length})</h2>
            {data.flags.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">—</p>
            ) : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {data.flags.map((f) => (
                  <li key={f.id} className="py-2">
                    <span className="font-medium">{t.flagReasons[f.reason]}</span>{" "}
                    <span className="text-xs text-ink-muted">· {f.state} · {f.byAccount ? "account" : "guest"} · {relativeTime(f.createdAt, locale)}</span>
                    {f.details && <p className="mt-0.5 text-ink-soft">{f.details}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5" aria-labelledby="hist-h">
            <h2 id="hist-h" className="mb-3 font-semibold">{t.issue.history}</h2>
            <Timeline updates={history} locale={locale} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5 lg:sticky lg:top-24">
            <ModerationActions issueId={issue.id} available={[...available]} />
          </section>
          <section className="card p-5" aria-labelledby="audit-h">
            <h2 id="audit-h" className="font-semibold">{t.moderation.auditLog}</h2>
            <ol className="mt-2 space-y-2 text-sm">
              {data.events.length === 0 && <li className="text-ink-muted">—</li>}
              {data.events.map((e) => (
                <li key={e.id} className="border-b border-line pb-2 last:border-0">
                  <p className="font-medium">{e.action} <span className="font-normal text-ink-muted">({e.from ?? "—"} → {e.to ?? "—"})</span></p>
                  <p className="text-xs text-ink-muted">{formatDateTime(e.createdAt, locale)} · <span className="font-mono">{e.actor}</span></p>
                  {e.note && <p className="mt-0.5 text-ink-soft">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
