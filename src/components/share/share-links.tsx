"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { ShareButton } from "./share-button";

/** Native share + explicit WhatsApp / Facebook links (common in Bangladesh). */
export function ShareLinks({ path, title }: { path: string; title: string }) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => setUrl(new URL(path, window.location.origin).toString()), [path]);
  const pill = "inline-flex h-9 items-center rounded-xl border border-white/30 px-3 text-sm font-medium text-white hover:bg-white/10";
  return (
    <>
      <ShareButton path={path} title={title} text={title} variant="onDark" />
      {url && (
        <>
          <a className={pill} href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a className={pill} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
            Facebook
          </a>
        </>
      )}
      <span className="sr-only">{t.areas.shareArea}</span>
    </>
  );
}
