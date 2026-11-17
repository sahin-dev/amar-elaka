"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { describedBy, Field, inputClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { safeNext } from "@/lib/safe-next";


export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errRef = useRef<HTMLDivElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { email, password, displayName, acceptGuidelines: accept }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        const emailVerified = body?.user?.emailVerified === true;
        router.push(!emailVerified ? `/verify-email?next=${encodeURIComponent(safeNext(next))}` : safeNext(next));
        router.refresh();
        return;
      }
      setErrors(body?.error?.fields ?? {});
      setFormError(
        res.status === 401 ? t.auth.invalidCredentials : res.status === 409 ? t.auth.emailTaken : (body?.error?.message ?? t.common.errorGeneric),
      );
      requestAnimationFrame(() => errRef.current?.focus());
    } catch {
      setFormError(t.common.errorNetwork);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card space-y-4 p-5">
      {formError && (
        <div ref={errRef} tabIndex={-1} className="outline-none">
          <Notice tone="danger" role="alert">{formError}</Notice>
        </div>
      )}
      <Field id="email" label={t.auth.email} error={errors.email}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          aria-invalid={!!errors.email}
          aria-describedby={describedBy("email", errors.email)}
        />
      </Field>
      <Field id="password" label={t.auth.password} hint={mode === "signup" ? t.auth.passwordHint : undefined} error={errors.password}>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 10 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          aria-invalid={!!errors.password}
          aria-describedby={describedBy("password", errors.password, mode === "signup" ? t.auth.passwordHint : undefined)}
        />
      </Field>
      {mode === "signup" && (
        <>
          <Field id="displayName" label={t.auth.displayName} optionalLabel={t.common.optional} hint={t.auth.displayNameHint} error={errors.displayName}>
            <input
              id="displayName"
              maxLength={40}
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              aria-describedby={describedBy("displayName", errors.displayName, t.auth.displayNameHint)}
            />
          </Field>
          <div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700"
                aria-invalid={!!errors.acceptGuidelines}
              />
              <span>
                {t.auth.acceptGuidelines}{" "}
                <Link href="/guidelines" className="text-brand-700 underline" target="_blank">
                  {t.common.guidelines}
                </Link>{" "}
                ·{" "}
                <Link href="/privacy" className="text-brand-700 underline" target="_blank">
                  {t.common.privacy}
                </Link>
              </span>
            </label>
            {errors.acceptGuidelines && <p className="mt-1 text-xs font-medium text-red-700">{errors.acceptGuidelines}</p>}
          </div>
        </>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? (mode === "login" ? t.auth.signingIn : t.auth.creating) : mode === "login" ? t.common.signIn : t.common.signUp}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        {mode === "login" ? t.auth.noAccount : t.auth.haveAccount}{" "}
        <Link href={`/${mode === "login" ? "signup" : "login"}?next=${encodeURIComponent(safeNext(next))}`} className="font-medium text-brand-700 underline">
          {mode === "login" ? t.common.signUp : t.common.signIn}
        </Link>
      </p>
    </form>
  );
}
