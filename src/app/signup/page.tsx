import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { isDbConfigured } from "@/server/db";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/safe-next";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.signUpTitle, robots: { index: false } };
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isDbConfigured()) return <SetupNotice />;
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  const { t } = await getI18n();
  return (
    <PageShell title={t.auth.signUpTitle} intro={t.auth.signUpIntro} width="sm">
      <AuthForm mode="signup" next={safeNext(next)} />
    </PageShell>
  );
}
