import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import { getI18n } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { getCurrentUser } from "@/server/auth/session";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { OfflineBanner } from "@/components/layout/offline-banner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const bangla = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bangla",
  display: "swap",
});

function appUrl(): URL {
  try {
    return new URL(process.env.APP_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    metadataBase: appUrl(),
    title: { default: `${t.common.appName} — ${t.common.tagline}`, template: `%s · ${t.common.appName}` },
    description: `${t.common.tagline}. ${t.disclaimer.community}`,
    applicationName: "AmarElaka",
    openGraph: { type: "website", siteName: "AmarElaka" },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14625c",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  const user = await getCurrentUser();
  return (
    <html lang={locale} className={`${inter.variable} ${bangla.variable}`}>
      <body className="min-h-dvh font-sans">
        <I18nProvider locale={locale}>
          <a
            href="#main"
            className="sr-only z-[2000] rounded-lg bg-white px-4 py-2 font-medium text-ink shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            {t.common.skipToContent}
          </a>
          <SiteHeader locale={locale} user={user ? { role: user.role, displayName: user.displayName } : null} />
          <OfflineBanner />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <SiteFooter locale={locale} />
          <BottomNav signedIn={!!user} />
        </I18nProvider>
      </body>
    </html>
  );
}
