"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { Icon, type IconName } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** Mobile bottom navigation with a raised central Report action. */
export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const left: { href: string; label: string; icon: IconName }[] = [
    { href: "/", label: t.common.explore, icon: "home" },
    { href: "/areas", label: t.common.areas, icon: "grid" },
  ];
  const right: { href: string; label: string; icon: IconName }[] = [
    { href: "/polls", label: t.common.polls, icon: "layers" },
    signedIn ? { href: "/account", label: t.common.account, icon: "user" } : { href: "/login", label: t.common.signIn, icon: "user" },
  ];

  const item = (i: { href: string; label: string; icon: IconName }) => (
    <Link
      key={i.href}
      href={i.href}
      aria-current={isActive(i.href) ? "page" : undefined}
      className={cn(
        "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
        isActive(i.href) ? "text-brand-700" : "text-ink-muted",
      )}
    >
      <Icon name={i.icon} size={22} />
      <span className="max-w-[72px] truncate">{i.label}</span>
    </Link>
  );

  return (
    <nav
      aria-label={t.common.mainNav}
      className="fixed inset-x-0 bottom-0 z-[1100] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-2">
        {left.map(item)}
        <div className="flex flex-1 items-start justify-center">
          <Link
            href="/report"
            aria-label={t.common.reportProblem}
            aria-current={isActive("/report") ? "page" : undefined}
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-fab ring-4 ring-white hover:bg-brand-800"
          >
            <Icon name="camera" size={24} />
          </Link>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}
