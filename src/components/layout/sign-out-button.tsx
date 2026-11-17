"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function SignOutButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          router.push("/");
          router.refresh();
        }
      }}
      className={cn("rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-canvas disabled:opacity-60", className)}
    >
      {label}
    </button>
  );
}
