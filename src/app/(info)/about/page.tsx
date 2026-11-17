import type { Metadata } from "next";
import Link from "next/link";
import { APP_CONFIG } from "@/config/app-config";
import { getI18n } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { Notice } from "@/components/ui/states";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pages.aboutTitle };
}

export default async function AboutPage() {
  const { locale, t } = await getI18n();
  const C = APP_CONFIG.community;
  return (
    <PageShell title={t.pages.aboutTitle}>
      <Notice tone="danger" className="mb-6">{t.disclaimer.emergency}</Notice>
      {locale === "bn" ? (
        <div className="prose-page">
          <p>আমার এলাকা একটি কমিউনিটি-চালিত প্ল্যাটফর্ম, যেখানে বাসিন্দারা জলাবদ্ধতা, রাস্তার গর্ত, নষ্ট সড়কবাতি, ময়লা বা বন্ধ রাস্তার মতো এলাকার সমস্যা জানাতে পারেন, এবং কাছাকাছি মানুষ নিশ্চিত করতে পারেন সমস্যাটি এখনও আছে কি না।</p>
          <h2>কীভাবে কাজ করে</h2>
          <ul>
            <li>একজন বাসিন্দা সমস্যা রিপোর্ট করেন — অবস্থান প্রকাশ্যে আনুমানিকভাবে (প্রায় ১৫০ মিটার) দেখানো হয়।</li>
            <li>অন্তত {C.verifyThreshold} জন আলাদা মানুষ নিশ্চিত করলে রিপোর্টটি “কমিউনিটি যাচাইকৃত” হয়।</li>
            <li>{C.resolutionWindowHours} ঘণ্টার মধ্যে অন্তত {C.resolutionThreshold} জন সাইন-ইন করা ব্যবহারকারী “ঠিক হয়েছে” জানালে এটি “কমিউনিটির মতে সমাধান হয়েছে” হিসেবে দেখানো হয়। একজনের ভোটে কখনো সমাধান হয় না।</li>
            <li>পরে আবার সমস্যা দেখা দিলে নতুন নিশ্চিতকরণে রিপোর্টটি আবার খোলা হয়।</li>
          </ul>
          <h2>যা আমরা দাবি করি না</h2>
          <p>এখানে কোনো সরকারি সংস্থার কাজের দাবি করা হয় না। “কমিউনিটির মতে সমাধান হয়েছে” মানে সরকারি নিশ্চিতকরণ নয়। কোনো সরকারি সংস্থার সঙ্গে আমাদের অংশীদারিত্ব নেই।</p>
          <h2>সতেজতা</h2>
          <p>প্রতিটি রিপোর্টে শেষ নিশ্চিতকরণের সময় দেখানো হয়: {APP_CONFIG.freshness.recentHours} ঘণ্টার কম হলে “সাম্প্রতিক”, {APP_CONFIG.freshness.checkHours / 24} দিনের কম হলে “হালনাগাদ যাচাই করুন”, তার বেশি হলে “সম্ভবত পুরনো”।</p>
        </div>
      ) : (
        <div className="prose-page">
          <p>AmarElaka is a community-powered platform where residents report neighbourhood problems — waterlogging, potholes, broken streetlights, garbage and blocked roads — and people nearby confirm whether they still exist.</p>
          <h2>How it works</h2>
          <ul>
            <li>A resident reports a problem. Its location is shown publicly only approximately (about 150 m).</li>
            <li>When at least {C.verifyThreshold} different people confirm it, the report becomes <strong>Community verified</strong>.</li>
            <li>When at least {C.resolutionThreshold} signed-in people report it fixed within {C.resolutionWindowHours} hours, it is labelled <strong>Community-reported resolved</strong>. A single vote never resolves a report.</li>
            <li>If the problem comes back, new confirmations reopen the report.</li>
          </ul>
          <h2>What we do not claim</h2>
          <p>AmarElaka does not claim that any government agency has acted. “Community-reported resolved” is not an official confirmation. AmarElaka has no official partnership with any government body.</p>
          <h2>Freshness</h2>
          <p>Each report shows when it was last confirmed: under {APP_CONFIG.freshness.recentHours} hours is “Recent”, up to {APP_CONFIG.freshness.checkHours / 24} days is “Check for updates”, and older reports are “Possibly outdated”.</p>
        </div>
      )}
      <p className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href="/guidelines" className="text-brand-700 underline">{t.common.guidelines}</Link>
        <Link href="/privacy" className="text-brand-700 underline">{t.common.privacy}</Link>
        <Link href="/safety" className="text-brand-700 underline">{t.common.safety}</Link>
      </p>
    </PageShell>
  );
}
