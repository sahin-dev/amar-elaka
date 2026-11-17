import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { relativeTime } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { isDbConfigured } from "@/server/db";
import { listMyReports } from "@/server/services/issues";
import { DeleteAccount, ProfileForm } from "@/components/account/account-settings";
import { StatusBadge } from "@/components/issues/badges";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Icon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.title, robots: { index: false } };
}

export default async function AccountPage() {
  if (!isDbConfigured()) return <SetupNotice />;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { locale, t } = await getI18n();
  const reports = await listMyReports(user);

  return (
    <PageShell title={t.account.title} intro={user.email} actions={<SignOutButton label={t.common.signOut} className="border border-line bg-white" />}>
      <div className="space-y-6">
        <section className="card p-5" aria-labelledby="profile-h">
          <h2 id="profile-h" className="mb-4 font-semibold">{t.account.profile}</h2>
          <p className="mb-4 text-sm text-ink-muted">
            {t.account.role}: <span className="font-medium text-ink">{user.role}</span>
          </p>
          <ProfileForm displayName={user.displayName} locale={user.locale} />
        </section>

        <section className="card p-5" aria-labelledby="mine-h">
          <h2 id="mine-h" className="font-semibold">{t.account.myReports}</h2>
          <p className="text-sm text-ink-muted">{t.account.myReportsHint}</p>
          {reports.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">{t.account.noReports}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-3">
                  <Link href={`/issues/${r.id}`} className="min-w-0 flex-1 font-medium hover:underline">
                    {r.title}
                  </Link>
                  <StatusBadge status={r.status} locale={locale} />
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-ink-soft">
                    {t.account.moderationState}: {t.modState[r.moderationState]}
                  </span>
                  <span className="w-full text-xs text-ink-muted" suppressHydrationWarning>
                    {relativeTime(r.createdAt, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5" aria-labelledby="data-h">
          <h2 id="data-h" className="font-semibold">{t.account.privacyTitle}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t.account.exportHint}</p>
          <a href="/api/account/export" className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[15px] font-medium hover:bg-canvas" download>
            <Icon name="download" size={18} />
            {t.account.exportData}
          </a>
          <p className="mt-3 text-sm">
            <Link href="/privacy" className="text-brand-700 underline">{t.common.privacy}</Link>
          </p>
        </section>

        <section className="card border-red-200 p-5" aria-labelledby="del-h">
          <h2 id="del-h" className="mb-3 font-semibold text-red-800">{t.account.deleteTitle}</h2>
          <DeleteAccount />
        </section>
      </div>
    </PageShell>
  );
}
