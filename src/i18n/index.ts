import en, { type Dictionary } from "./en";
import bn from "./bn";

export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "ae_locale";

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "bn";
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === "bn" ? bn : en;
}

/** Replace {name} placeholders. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function intlLocale(locale: Locale): string {
  return locale === "bn" ? "bn-BD" : "en-GB";
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

/** "3 hours ago" / "৩ ঘণ্টা আগে" */
export function relativeTime(date: Date | string, locale: Locale, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}

export function formatDateTime(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(d);
}

/** Pick a locale from an Accept-Language header. Defaults to Bangla. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return "bn";
  const langs = acceptLanguage
    .split(",")
    .map((p) => p.trim().split(";")[0]?.toLowerCase() ?? "")
    .filter(Boolean);
  for (const l of langs) {
    if (l.startsWith("bn")) return "bn";
    if (l.startsWith("en")) return "en";
  }
  return "bn";
}

export type { Dictionary };
