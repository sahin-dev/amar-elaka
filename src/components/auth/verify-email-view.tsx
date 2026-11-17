"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n";
import { safeNext } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";

type Status = "verifying" | "verified" | "error" | "idle" | "sending" | "sent";
type ErrorKind = "verify" | "resend";

const copy = {
  en: {
    title: "Verify your email",
    instructions: "Check your inbox for a verification link. Open the link here to verify your account.",
    verifying: "Verifying your email…",
    verified: "Your email is verified. Taking you back…",
    invalid: "This verification link is invalid, expired, or already used. You can request a new one below.",
    resend: "Send a new verification email",
    sending: "Sending…",
    sent: "If your account needs verification, a new email has been sent.",
    resendFailed: "Could not send a verification email. Please sign in and try again.",
    signIn: "Sign in",
    home: "Go to Explore",
  },
  bn: {
    title: "ইমেইল যাচাই করুন",
    instructions: "যাচাই লিংকের জন্য আপনার ইনবক্স দেখুন। অ্যাকাউন্ট যাচাই করতে লিংকটি খুলুন।",
    verifying: "ইমেইল যাচাই করা হচ্ছে…",
    verified: "আপনার ইমেইল যাচাই হয়েছে। আপনাকে আগের পাতায় নেওয়া হচ্ছে…",
    invalid: "এই যাচাই লিংকটি অবৈধ, মেয়াদোত্তীর্ণ বা ইতিমধ্যে ব্যবহার করা হয়েছে। নিচে নতুন লিংক চাইতে পারেন।",
    resend: "নতুন যাচাই ইমেইল পাঠান",
    sending: "পাঠানো হচ্ছে…",
    sent: "আপনার অ্যাকাউন্ট যাচাইয়ের প্রয়োজন হলে নতুন ইমেইল পাঠানো হয়েছে।",
    resendFailed: "যাচাই ইমেইল পাঠানো যায়নি। সাইন ইন করে আবার চেষ্টা করুন।",
    signIn: "সাইন ইন",
    home: "এক্সপ্লোরে যান",
  },
} satisfies Record<Locale, Record<string, string>>;

export function VerifyEmailView({ token, next, locale }: { token: string; next: string; locale: Locale }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(token ? "verifying" : "idle");
  const [errorKind, setErrorKind] = useState<ErrorKind>("verify");
  const labels = copy[locale];

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!response.ok) {
          if (active) {
            setErrorKind("verify");
            setStatus("error");
          }
          return;
        }
        if (active) {
          setStatus("verified");
          router.replace(safeNext(next));
          router.refresh();
        }
      } catch {
        if (active) {
          setErrorKind("verify");
          setStatus("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [next, router, token]);

  async function resend() {
    setErrorKind("resend");
    setStatus("sending");
    try {
      const response = await fetch("/api/auth/verification/resend", { method: "POST" });
      setStatus(response.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  const errorMessage = status === "error" ? (errorKind === "verify" ? labels.invalid : labels.resendFailed) : null;

  return (
    <section className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      <div className="card space-y-5 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{labels.title}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{labels.instructions}</p>
        </div>

        {status === "verifying" && <Notice role="status">{labels.verifying}</Notice>}
        {status === "verified" && <Notice tone="success" role="status">{labels.verified}</Notice>}
        {errorMessage && <Notice tone="danger" role="alert">{errorMessage}</Notice>}
        {status === "sent" && <Notice tone="success" role="status">{labels.sent}</Notice>}

        {(status === "idle" || status === "error" || status === "sent") && (
          <div className="space-y-4">
            <Button type="button" onClick={resend} className="w-full">{labels.resend}</Button>
            <p className="text-center text-sm text-ink-muted">
              <Link href={`/login?next=${encodeURIComponent(safeNext(next))}`} className="font-medium text-brand-700 underline">
                {labels.signIn}
              </Link>
            </p>
          </div>
        )}
        {status === "sending" && <Button type="button" className="w-full" disabled>{labels.sending}</Button>}
        <p className="text-center text-sm">
          <Link href="/" className="text-brand-700 underline">{labels.home}</Link>
        </p>
      </div>
    </section>
  );
}
