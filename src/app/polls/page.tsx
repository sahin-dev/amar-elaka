import type { Metadata } from "next";
import { PollsView } from "@/components/polls/polls-view";
import { isDbConfigured } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { getLocale } from "@/i18n/server";
import { SetupNotice } from "@/components/layout/setup-notice";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === "bn"
    ? { title: "জনমত জরিপ", description: "বাংলাদেশের জনস্বার্থের বিষয়ে মতামত দিন এবং ফল দেখুন।" }
    : { title: "Community polls", description: "Have your say on public questions shaping Bangladesh." };
}

export default async function PollsPage() {
  if (!isDbConfigured()) return <SetupNotice />;
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const canManage = user?.role === "moderator" || user?.role === "admin";
  return <PollsView locale={locale} canManage={canManage} />;
}
