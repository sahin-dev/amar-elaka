import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { Notice } from "@/components/ui/states";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pages.guidelinesTitle };
}

export default async function GuidelinesPage() {
  const { locale, t } = await getI18n();
  return (
    <PageShell title={t.pages.guidelinesTitle}>
      <Notice tone="warn" className="mb-6">
        {locale === "bn"
          ? "খসড়া: প্রকাশ্যে চালুর আগে বাংলাদেশের একজন যোগ্য আইন বিশেষজ্ঞের পর্যালোচনা প্রয়োজন।"
          : "Draft: requires review by a qualified Bangladesh legal professional before public launch."}
      </Notice>
      {locale === "bn" ? (
        <div className="prose-page">
          <h2>যা রিপোর্ট করবেন</h2>
          <ul>
            <li>জনপরিসরের সমস্যা: রাস্তা, ড্রেন, সড়কবাতি, ময়লা, জলাবদ্ধতা, বন্ধ রাস্তা।</li>
            <li>যা আপনি নিজে দেখেছেন। তথ্যভিত্তিক ও নির্দিষ্ট থাকুন।</li>
          </ul>
          <h2>যা করবেন না</h2>
          <ul>
            <li>কারো মুখ, গাড়ির নম্বর প্লেট বা চেনা যায় এমন মানুষের ছবি দেবেন না।</li>
            <li>ফোন নম্বর, ঠিকানা, পরিচয়পত্র বা অন্য ব্যক্তিগত তথ্য দেবেন না।</li>
            <li>নাম ধরে কাউকে দোষারোপ, মানহানিকর দাবি বা হয়রানি করবেন না।</li>
            <li>ব্যক্তিগত সম্পত্তির ভেতরের ছবি দেবেন না।</li>
            <li>মিথ্যা বা বিভ্রান্তিকর রিপোর্ট, স্প্যাম বা বিজ্ঞাপন দেবেন না।</li>
            <li>জরুরি অবস্থায় এখানে রিপোর্ট নয় — ৯৯৯-এ কল করুন।</li>
          </ul>
          <h2>মডারেশন</h2>
          <p>নির্দেশিকা ভঙ্গ করলে মডারেটররা রিপোর্ট বা ছবি লুকাতে, প্রত্যাখ্যান করতে, একীভূত করতে বা আর্কাইভ করতে পারেন। প্রতিটি পদক্ষেপ অডিট লগে থাকে।</p>
          <h2>সংশোধন ও আপত্তি</h2>
          <p>কোনো রিপোর্টে আপনার সম্পর্কে তথ্য থাকলে বা ভুল মনে হলে রিপোর্ট পেজে “ফ্ল্যাগ করুন” → “সংশোধন বা অপসারণের অনুরোধ” বেছে নিন। আপনার নিজের রিপোর্ট লুকানো হলে একইভাবে আপত্তি জানাতে পারেন।</p>
        </div>
      ) : (
        <div className="prose-page">
          <h2>What to report</h2>
          <ul>
            <li>Problems in public spaces: roads, drains, streetlights, garbage, waterlogging, blocked roads.</li>
            <li>Things you have seen yourself. Be factual and specific.</li>
          </ul>
          <h2>What not to post</h2>
          <ul>
            <li>Faces, number plates, or anyone who could be identified.</li>
            <li>Phone numbers, addresses, ID documents or other personal information.</li>
            <li>Accusations against named individuals, defamatory claims or harassment.</li>
            <li>The inside of private property.</li>
            <li>False or misleading reports, spam or advertising.</li>
            <li>Emergencies — call 999 instead.</li>
          </ul>
          <h2>Moderation</h2>
          <p>Moderators may hide, reject, merge or archive reports and photos that break these guidelines. Every moderator action is recorded in an audit log.</p>
          <h2>Corrections and appeals</h2>
          <p>If a report contains information about you or is wrong, open the report and choose “Flag this report” → “Correction or removal request”. If your own report was hidden, you can appeal the same way.</p>
        </div>
      )}
    </PageShell>
  );
}
