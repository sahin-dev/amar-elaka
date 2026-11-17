import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";
import { getI18n } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { Notice } from "@/components/ui/states";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pages.privacyTitle };
}

export default async function PrivacyPage() {
  const { locale, t } = await getI18n();
  const days = APP_CONFIG.privacy.exactLocationRetentionDays;
  return (
    <PageShell title={t.pages.privacyTitle}>
      <Notice tone="warn" className="mb-6">
        {locale === "bn"
          ? "খসড়া গোপনীয়তা নীতি। এটি কোনো আইনি সম্মতির দাবি নয়; প্রকাশ্যে চালুর আগে বাংলাদেশের একজন যোগ্য আইন বিশেষজ্ঞের পর্যালোচনা প্রয়োজন।"
          : "Draft privacy notice. This is not a claim of legal compliance; it requires review by a qualified Bangladesh legal professional before public launch."}
      </Notice>
      {locale === "bn" ? (
        <div className="prose-page">
          <h2>যা প্রকাশ্যে দেখানো হয়</h2>
          <ul>
            <li>রিপোর্টের ধরন, শিরোনাম, বিবরণ, অবস্থা ও সময়।</li>
            <li>আনুমানিক অবস্থান (প্রায় ১৫০ মিটারের গ্রিডে)।</li>
            <li>মডারেটর অনুমোদিত ছবি — অবস্থান-তথ্য (EXIF/GPS) মুছে ফেলার পর।</li>
          </ul>
          <p>রিপোর্টকারীর নাম, ইমেইল, অ্যাকাউন্ট আইডি বা সঠিক অবস্থান কখনো প্রকাশ্যে দেখানো হয় না।</p>
          <h2>যা আমরা গোপনে সংরক্ষণ করি</h2>
          <ul>
            <li>অ্যাকাউন্ট: ইমেইল, পাসওয়ার্ডের হ্যাশ, ঐচ্ছিক প্রদর্শিত নাম, ভাষা।</li>
            <li>সঠিক অবস্থান: শুধু মডারেটরদের জন্য, {days} দিন পর স্বয়ংক্রিয়ভাবে মুছে যায়।</li>
            <li>আইপি ঠিকানার একমুখী হ্যাশ (মূল আইপি নয়) — স্প্যাম ও অপব্যবহার ঠেকাতে।</li>
            <li>আপনার ভোট ও ফ্ল্যাগ, যাতে একই ব্যক্তি বারবার ভোট দিতে না পারেন।</li>
          </ul>
          <h2>কুকি</h2>
          <p>শুধু সাইন-ইন রাখার জন্য একটি সেশন কুকি এবং ভাষা মনে রাখার জন্য একটি কুকি ব্যবহার হয়। কোনো বিজ্ঞাপন বা ট্র্যাকিং কুকি নেই।</p>
          <h2>আপনার অধিকার</h2>
          <ul>
            <li>অ্যাকাউন্ট পেজ থেকে আপনার তথ্য JSON হিসেবে ডাউনলোড করতে পারেন।</li>
            <li>অ্যাকাউন্ট মুছতে পারেন; চাইলে আপনার রিপোর্টও প্রকাশ্য থেকে সরানো যায়। ইতিহাস ঠিক রাখতে আপনার ভোট নামহীনভাবে থেকে যায়।</li>
          </ul>
          <h2>তৃতীয় পক্ষ</h2>
          <p>ডেটা MongoDB Atlas-এ সংরক্ষিত এবং ম্যাপ টাইল একটি OpenStreetMap-সামঞ্জস্যপূর্ণ সেবা থেকে লোড হয় (যা আপনার আইপি দেখতে পায়)। হোস্টিং সেবাদাতাও অনুরোধের লগ রাখতে পারে।</p>
          <p>জরিপে আপনার নির্বাচিত উত্তর ও আইপি ঠিকানার সুরক্ষিত একমুখী হ্যাশ সংরক্ষিত হয়, তবে কাঁচা আইপি বা অ্যাকাউন্টের পরিচয়ের সঙ্গে ভোট যুক্ত করা হয় না। পুনরায় ভোট ঠেকাতে ব্রাউজারে একটি সুরক্ষিত কুকি রাখা হয় এবং রেকর্ডে তার হ্যাশ সংরক্ষণ করা হয়। ফলাফলে শুধু মোট ভোট দেখানো হয়। জরিপের রেকর্ডের সঙ্গে ভোট সংরক্ষিত থাকে।</p>
        </div>
      ) : (
        <div className="prose-page">
          <h2>What is public</h2>
          <ul>
            <li>Report category, title, description, status and timestamps.</li>
            <li>An approximate location, snapped to a grid of about 150 m.</li>
            <li>Moderator-approved photos, after location metadata (EXIF/GPS) is removed.</li>
          </ul>
          <p>Reporter names, email addresses, account IDs and exact locations are never shown publicly.</p>
          <h2>What we store privately</h2>
          <ul>
            <li>Account: email, a password hash, an optional display name, language preference.</li>
            <li>Exact report location: visible to moderators only and automatically deleted after {days} days.</li>
            <li>A keyed one-way hash of your IP address (never the raw IP), for spam and abuse prevention.</li>
            <li>Your votes and flags, so the same person cannot vote repeatedly.</li>
            <li>Poll votes are stored with keyed hashes of your IP address and a random browser ID to enforce one vote per IP and browser profile per poll. A secure first-party cookie holds the browser ID; raw IPs and account identities are not attached to votes. Only poll totals are shown, and vote records remain with their poll.</li>
          </ul>
          <h2>Cookies</h2>
          <p>A session cookie keeps you signed in, a preference cookie remembers your language, and polls use a secure first-party cookie to remember the browser profile vote key. There are no advertising cookies.</p>
          <h2>Your choices</h2>
          <ul>
            <li>Download your data as JSON from your account page.</li>
            <li>Delete your account; optionally remove your reports from public view. Votes are kept without any link to you so histories stay accurate.</li>
          </ul>
          <h2>Third parties</h2>
          <p>Data is stored in MongoDB Atlas. Map tiles load from an OpenStreetMap-compatible tile provider, which can see your IP address. The hosting provider may keep request logs.</p>
        </div>
      )}
    </PageShell>
  );
}
