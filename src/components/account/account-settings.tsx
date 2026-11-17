"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/states";

export function ProfileForm({ displayName, locale: initialLocale }: { displayName: string; locale: Locale }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, locale }),
      });
      if (!res.ok) throw new Error();
      await fetch("/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field id="displayName" label={t.auth.displayName} hint={t.auth.displayNameHint}>
        <input id="displayName" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} aria-describedby="displayName-hint" />
      </Field>
      <Field id="locale" label={t.account.language}>
        <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className={inputClass}>
          <option value="bn">বাংলা</option>
          <option value="en">English</option>
        </select>
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === "saving"}>
          {t.common.save}
        </Button>
        <span aria-live="polite" className="text-sm">
          {state === "saved" && <span className="text-green-800">{t.common.saved}</span>}
          {state === "error" && <span className="text-red-700">{t.common.errorGeneric}</span>}
        </span>
      </div>
    </form>
  );
}

export function DeleteAccount() {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [removeReports, setRemoveReports] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(t.account.deleteWarning)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, removeReports }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.message ?? t.common.errorGeneric);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(t.common.errorNetwork);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={del} className="space-y-4">
      <Notice tone="danger">{t.account.deleteWarning}</Notice>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={removeReports} onChange={(e) => setRemoveReports(e.target.checked)} className="mt-0.5 h-5 w-5 accent-red-700" />
        {t.account.removeReports}
      </label>
      <Field id="delete-password" label={t.account.confirmPassword}>
        <input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
      </Field>
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
      <Button type="submit" variant="danger" disabled={busy || !password}>
        <Icon name="trash" size={16} />
        {busy ? t.account.deleting : t.account.deleteButton}
      </Button>
    </form>
  );
}
