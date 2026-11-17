"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * Uses the native share sheet on mobile (WhatsApp, Messenger, etc.) and
 * falls back to copying the link on desktop.
 */
export function ShareButton({
  path,
  title,
  text,
  variant = "inline",
  className,
}: {
  path: string;
  title: string;
  text?: string;
  variant?: "inline" | "button" | "onDark";
  className?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(t.common.copyLink, url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        variant === "inline"
          ? "relative z-10 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-ink-soft hover:bg-black/5"
          : variant === "onDark"
            ? "inline-flex h-9 items-center gap-2 rounded-xl border border-white/30 px-3 text-sm font-medium text-white hover:bg-white/10"
            : "inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[15px] font-medium text-ink hover:bg-canvas",
        className,
      )}
    >
      <Icon name={copied ? "check" : "share"} size={variant === "button" ? 18 : 14} />
      <span aria-live="polite">{copied ? t.common.linkCopied : t.common.share}</span>
    </button>
  );
}
