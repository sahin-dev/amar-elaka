"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { ErrorState } from "@/components/ui/states";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  const unavailable = /not configured|MONGODB_URI/i.test(error.message);
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <ErrorState
        message={unavailable ? "The database is not configured yet. See README → Setup." : t.common.errorGeneric}
        onRetry={reset}
        retryLabel={t.common.retry}
      />
    </div>
  );
}
