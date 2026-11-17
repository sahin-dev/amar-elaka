"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";

export function PhotoReview({ photoId }: { photoId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/photos/${photoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error?.message ?? t.common.errorGeneric);
      else router.refresh();
    } catch {
      setError(t.common.errorNetwork);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => decide("approve")} disabled={busy}>
          {t.moderation.approvePhoto}
        </Button>
        <Button size="sm" variant="danger" onClick={() => decide("reject")} disabled={busy}>
          {t.moderation.rejectPhoto}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
