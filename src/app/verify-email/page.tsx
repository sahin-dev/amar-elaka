import type { Metadata } from "next";
import { getLocale } from "@/i18n/server";
import { VerifyEmailView } from "@/components/auth/verify-email-view";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const [{ token, next }, locale] = await Promise.all([searchParams, getLocale()]);
  return <VerifyEmailView token={token ?? ""} next={next ?? "/"} locale={locale} />;
}
