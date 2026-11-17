import Link from "next/link";
import { getDictionary, type Locale } from "@/i18n";
import type { SessionUser } from "@/server/auth/session";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { LanguageToggle } from "./language-toggle";
import { SignOutButton } from "./sign-out-button";

export function Logo({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <Link href="/" className="flex items-center gap-2 rounded-lg" aria-label={`${t.common.appName} — ${t.common.explore}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-700 text-white" aria-hidden="true">
        <Icon name="pin" size={18} />
      </span>
      <span className="text-[17px] font-bold tracking-tight text-ink">{t.common.appName}</span>
    </Link>
  );
}

export function SiteHeader({ locale, user }: { locale: Locale; user: Pick<SessionUser, "role" | "displayName"> | null }) {
  const t = getDictionary(locale);
  const isMod = user?.role === "moderator" || user?.role === "admin";
  return (
    <header className="sticky top-0 z-[1100] border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:h-16 md:px-6">
        <Logo locale={locale} />
        <nav aria-label={t.common.mainNav} className="ml-4 hidden items-center gap-1 md:flex">
          <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">
            {t.common.explore}
          </Link>
          <Link href="/areas" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">
            {t.common.areas}
          </Link>
          <Link href="/polls" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">
            {t.common.polls}
          </Link>
          <Link href="/about" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">
            {t.common.about}
          </Link>
          {isMod && (
            <Link href="/moderation" className="rounded-lg px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-50">
              {t.common.moderation}
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          {isMod && (
            <Link href="/moderation" className="rounded-full p-2 text-violet-800 hover:bg-violet-50 md:hidden" aria-label={t.common.moderation}>
              <Icon name="shield" />
            </Link>
          )}
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link href="/account" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">
                  {t.common.account}
                </Link>
                <SignOutButton label={t.common.signOut} />
              </>
            ) : (
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">
                {t.common.signIn}
              </Link>
            )}
            <ButtonLink href="/report" size="sm" className="ml-1">
              <Icon name="plus" size={16} />
              {t.common.reportProblem}
            </ButtonLink>
          </div>
        </div>
      </div>
    </header>
  );
}
