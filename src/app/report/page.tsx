import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { isDbConfigured } from "@/server/db";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ReportForm } from "@/components/report/report-form";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.report.title };
}

export default async function ReportPage() {
  if (!isDbConfigured()) return <SetupNotice />;
  const { t } = await getI18n();
  const user = await getCurrentUser();
  return (
    <PageShell title={t.report.title} intro={t.report.intro}>
      {user?.emailVerified ? (
        <ReportForm />
      ) : user ? (
        <div className="card space-y-4 p-6">
          <Notice tone="warn">Verify your email before submitting a problem report.</Notice>
          <ButtonLink href="/verify-email?next=/report">Verify email</ButtonLink>
        </div>
      ) : (
        <div className="card space-y-4 p-6">
          <Notice tone="info">{t.report.signInRequired}</Notice>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/login?next=/report">{t.common.signIn}</ButtonLink>
            <ButtonLink href="/signup?next=/report" variant="outline">
              {t.common.signUp}
            </ButtonLink>
          </div>
        </div>
      )}
    </PageShell>
  );
}
