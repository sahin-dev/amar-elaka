"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  async function toggle() {
    const next = locale === "bn" ? "en" : "bn";
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
    } catch {
      // Fall back to a client-set cookie if offline.
      document.cookie = `ae_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    }
    start(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={t.common.switchLanguageLabel}
      lang={locale === "bn" ? "en" : "bn"}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm font-medium text-ink-soft hover:bg-canvas disabled:opacity-60",
        className,
      )}
    >
      <Icon name="globe" size={16} />
      {t.common.switchLanguage}
    </button>
  );
}
