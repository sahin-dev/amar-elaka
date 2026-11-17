"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { fmt, formatNumber } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { FLAG_REASONS, type FlagReason } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/states";
import { inputClass } from "@/components/ui/field";

type Msg = { tone: "success" | "warn" | "danger"; text: string; signIn?: boolean } | null;

export function VoteActions({
  issueId,
  presentCount,
  fixedCount,
  signedIn,
  emailVerified,
  canVote,
}: {
  issueId: string;
  presentCount: number;
  fixedCount: number;
  signedIn: boolean;
  emailVerified: boolean;
  canVote: boolean;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<"present" | "fixed" | "flag" | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [counts, setCounts] = useState({ present: presentCount, fixed: fixedCount });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<FlagReason>("inaccurate");
  const [details, setDetails] = useState("");
  const [flagMsg, setFlagMsg] = useState<string | null>(null);

  function messageFor(status: number, code?: string, fallback?: string): Msg {
    if (status === 409) return { tone: "warn", text: t.issue.alreadyVoted };
    if (status === 401) return { tone: "warn", text: t.issue.fixedNeedsAccount, signIn: true };
    if (status === 403 && code === "FORBIDDEN") return { tone: "warn", text: t.issue.ownReport };
    return { tone: "danger", text: fallback ?? t.common.errorGeneric };
  }

  async function vote(kind: "present" | "fixed") {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setCounts({ present: body.presentCount, fixed: body.fixedCount });
        setMsg({ tone: "success", text: t.issue.voted });
        router.refresh();
      } else {
        setMsg(messageFor(res.status, body?.error?.code, body?.error?.message));
      }
    } catch {
      setMsg({ tone: "danger", text: t.common.errorNetwork });
    } finally {
      setBusy(null);
    }
  }

  async function sendFlag(e: React.FormEvent) {
    e.preventDefault();
    setBusy("flag");
    setFlagMsg(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        dialogRef.current?.close();
        setMsg({ tone: "success", text: t.issue.flagThanks });
        router.refresh();
      } else if (res.status === 409) {
        setFlagMsg(body?.error?.message ?? t.issue.alreadyVoted);
      } else {
        setFlagMsg(body?.error?.message ?? t.common.errorGeneric);
      }
    } catch {
      setFlagMsg(t.common.errorNetwork);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {canVote && emailVerified && (
        <>
          <Button className="w-full justify-start" size="lg" onClick={() => vote("present")} disabled={!!busy}>
            <Icon name="alert" size={18} />
            <span className="flex-1 text-left">{t.issue.confirmPresent}</span>
            <span className="rounded-full bg-white/20 px-2 text-sm">{formatNumber(counts.present, locale)}</span>
          </Button>
          <Button variant="secondary" className="w-full justify-start" size="lg" onClick={() => vote("fixed")} disabled={!!busy}>
            <Icon name="checkCircle" size={18} />
            <span className="flex-1 text-left">{t.issue.reportFixed}</span>
            <span className="rounded-full bg-brand-100 px-2 text-sm">{formatNumber(counts.fixed, locale)}</span>
          </Button>
        </>
      )}
      {canVote && !emailVerified && <Notice tone="info">
        {signedIn ? "Verify your email to vote on this report." : "Create an account and verify your email to vote."}{" "}
        <Link href={signedIn ? "/verify-email?next=/issues" : "/signup?next=/issues"} className="font-semibold underline">{signedIn ? "Verify email" : t.common.signUp}</Link>
      </Notice>}
      <Button
        variant="ghost"
        className="w-full justify-start text-red-800 hover:bg-red-50"
        onClick={() => {
          setFlagMsg(null);
          dialogRef.current?.showModal();
        }}
        disabled={!!busy}
      >
        <Icon name="flag" size={18} />
        {t.issue.flag}
      </Button>

      <div aria-live="polite">
        {msg && (
          <Notice tone={msg.tone}>
            {msg.text}{" "}
            {msg.signIn && (
              <Link href={`/login?next=/issues/${issueId}`} className="font-semibold underline">
                {t.common.signIn}
              </Link>
            )}
          </Notice>
        )}
      </div>
      <p className="sr-only">
        {fmt(t.issue.confirmations, { n: counts.present })}, {fmt(t.issue.fixedReports, { n: counts.fixed })}
      </p>

      <dialog
        ref={dialogRef}
        aria-labelledby="flag-title"
        className="w-[min(92vw,28rem)] rounded-2xl p-0 backdrop:bg-black/40"
      >
        <form onSubmit={sendFlag} className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <h2 id="flag-title" className="text-lg font-semibold">
              {t.issue.flagTitle}
            </h2>
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full p-1 hover:bg-canvas" aria-label={t.common.close}>
              <Icon name="x" />
            </button>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">{t.issue.flagReason}</legend>
            <div className="mt-2 space-y-1">
              {FLAG_REASONS.map((r) => (
                <label key={r} className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-canvas">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-brand-700" />
                  <span className="text-sm">{t.flagReasons[r]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="flag-details" className="text-sm font-medium">
              {t.issue.flagDetails}
            </label>
            <textarea id="flag-details" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} className={`${inputClass} mt-1.5`} />
          </div>
          {flagMsg && <Notice tone="danger" role="alert">{flagMsg}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="danger" disabled={busy === "flag"}>
              {t.issue.flagSubmit}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
