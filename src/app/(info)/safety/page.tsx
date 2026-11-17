import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { Icon } from "@/components/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pages.safetyTitle };
}

export default async function SafetyPage() {
  const { locale, t } = await getI18n();
  return (
    <PageShell title={t.pages.safetyTitle}>
      <div className="card flex items-start gap-4 border-red-200 bg-red-50 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-700 text-white">
          <Icon name="phone" size={24} />
        </span>
        <div>
          <p className="text-lg font-semibold text-red-900">{t.disclaimer.emergency}</p>
          <a href="tel:999" className="mt-2 inline-flex h-11 items-center rounded-xl bg-red-700 px-5 font-semibold text-white hover:bg-red-800">
            999
          </a>
        </div>
      </div>
      {locale === "bn" ? (
        <div className="prose-page">
          <p>আমার এলাকা কোনো জরুরি সেবা নয় এবং রিপোর্টগুলো কেউ সার্বক্ষণিক পর্যবেক্ষণ করেন না। আগুন, দুর্ঘটনা, অপরাধ, বিদ্যুতের তার ছিঁড়ে পড়া, ভবন ধস বা জীবনের ঝুঁকি থাকলে সরাসরি ৯৯৯-এ কল করুন।</p>
          <p>রিপোর্টগুলো কমিউনিটির সদস্যরা জমা দেন এবং এগুলো সরকারি তথ্য নয়। কোনো রিপোর্টে লেখা অবস্থা ভুল বা পুরনো হতে পারে — “সতেজতা” লেবেল দেখে সিদ্ধান্ত নিন।</p>
          <p>জলাবদ্ধ রাস্তা বা গর্তের কাছে যাওয়ার সময় সাবধান থাকুন। ছবি তোলার জন্য নিজেকে ঝুঁকিতে ফেলবেন না।</p>
        </div>
      ) : (
        <div className="prose-page">
          <p>AmarElaka is not an emergency service and reports are not monitored around the clock. For fire, accidents, crime, fallen electrical wires, building collapse or any risk to life, call 999 directly.</p>
          <p>Reports are submitted by community members and are not official information. A report’s status may be wrong or out of date — check its freshness label before relying on it.</p>
          <p>Take care near flooded roads or open holes. Never put yourself at risk to take a photo.</p>
        </div>
      )}
    </PageShell>
  );
}
