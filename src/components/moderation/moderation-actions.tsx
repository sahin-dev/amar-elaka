"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { ModerationAction } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

export function ModerationActions({ issueId, available }: { issueId: string; available: ModerationAction[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [chosen, setAction] = useState<ModerationAction>(available[0] ?? "approve");
  // After an action the allowed set changes; fall back to a valid choice.
  const action = available.includes(chosen) ? chosen : (available[0] ?? chosen);
  const [note, setNote] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/moderation/issues/${issueId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note, ...(action === "merge" ? { targetIssueId: target.trim() } : {}) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const field = body?.error?.fields ? Object.values(body.error.fields)[0] : null;
        setMsg({ tone: "danger", text: (field as string) ?? body?.error?.message ?? t.common.errorGeneric });
        return;
      }
      setMsg({ tone: "success", text: t.moderation.done });
      setNote("");
      router.refresh();
    } catch {
      setMsg({ tone: "danger", text: t.common.errorNetwork });
    } finally {
      setBusy(false);
    }
  }

  if (!available.length) return null;

  return (
    <form onSubmit={apply} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium">{t.moderation.actions}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {available.map((a) => (
            <label
              key={a}
              className={`inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600 ${action === a ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
            >
              <input type="radio" name="action" value={a} checked={action === a} onChange={() => setAction(a)} className="sr-only" />
              {t.moderation[a]}
            </label>
          ))}
        </div>
      </fieldset>
      {action === "merge" && (
        <Field id="target" label={t.moderation.targetIssue}>
          <input id="target" value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputClass} font-mono`} placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx" />
        </Field>
      )}
      <Field id="note" label={t.moderation.note}>
        <textarea id="note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </Field>
      {msg && <Notice tone={msg.tone} role={msg.tone === "danger" ? "alert" : "status"}>{msg.text}</Notice>}
      <Button type="submit" disabled={busy}>
        {t.moderation.apply}
      </Button>
    </form>
  );
}
