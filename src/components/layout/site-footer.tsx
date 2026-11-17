import Link from "next/link";
import { getDictionary, type Locale } from "@/i18n";
import { Icon } from "@/components/ui/icons";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <footer className="border-t border-line bg-white pb-24 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <p className="flex items-start gap-2 text-sm font-medium text-red-800">
          <Icon name="phone" size={16} className="mt-0.5 shrink-0" />
          {t.disclaimer.emergency}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{t.disclaimer.community}</p>
        <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
          <Link href="/about" className="hover:text-ink hover:underline">{t.common.about}</Link>
          <Link href="/guidelines" className="hover:text-ink hover:underline">{t.common.guidelines}</Link>
          <Link href="/privacy" className="hover:text-ink hover:underline">{t.common.privacy}</Link>
          <Link href="/safety" className="hover:text-ink hover:underline">{t.common.safety}</Link>
        </nav>
        <p className="mt-4 text-xs text-ink-faint">
          © {new Date().getFullYear()} {t.common.appName} · Map data © OpenStreetMap contributors
        </p>
      </div>
    </footer>
  );
}
