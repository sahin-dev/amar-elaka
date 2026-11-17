"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { APP_CONFIG, CATEGORIES, type CategoryId } from "@/config/app-config";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { LatLng } from "@/lib/geo";
import { isInBangladesh } from "@/lib/geo";
import type { PublicIssueSummary } from "@/lib/public-types";
import { cn } from "@/lib/cn";
import { LocationPicker } from "@/components/map";
import { ShareButton } from "@/components/share/share-button";
import { Button, ButtonLink } from "@/components/ui/button";
import { describedBy, Field, inputClass } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/states";
import { IssueCard } from "@/components/issues/issue-card";
import { compressImage } from "./compress-image";

type Errors = Record<string, string>;
type Success = { id: string; moderationState: string; photoPending: boolean };

const R = APP_CONFIG.reports;

export function ReportForm() {
  const { locale, t } = useI18n();
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [flyKey, setFlyKey] = useState<string | undefined>();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<PublicIssueSummary[] | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function useMyLocation() {
    if (!("geolocation" in navigator)) return setLocMsg(t.common.locationDenied);
    setLocating(true);
    setLocMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLoc(p);
        setFlyKey(String(Date.now()));
        setLocating(false);
      },
      () => {
        setLocMsg(t.common.locationDenied);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setErrors((prev) => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });
    if (!f) return;
    if (!(APP_CONFIG.photos.allowedMime as readonly string[]).includes(f.type)) {
      setErrors((x) => ({ ...x, photo: t.report.photoHint.replace("{mb}", "5") }));
      e.target.value = "";
      return;
    }
    const small = await compressImage(f);
    if (small.size > APP_CONFIG.photos.maxBytes) {
      setErrors((x) => ({ ...x, photo: t.report.photoHint.replace("{mb}", "5") }));
      e.target.value = "";
      return;
    }
    setPhoto(small);
    setPreview(URL.createObjectURL(small));
  }

  function removePhoto() {
    setPhoto(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function clientValidate(): Errors {
    const e: Errors = {};
    if (!category) e.category = t.common.required;
    if (title.trim().length < R.titleMin) e.title = `${t.report.shortTitle}: ≥ ${R.titleMin}`;
    if (!loc) e.location = t.report.locationRequired;
    else if (!isInBangladesh(loc)) e.location = t.report.locationRequired;
    return e;
  }

  async function submit(acknowledgeDuplicate = false) {
    setFormError(null);
    const e = clientValidate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError(t.report.fixErrors);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const fd = new FormData();
    fd.set("category", category!);
    fd.set("title", title);
    fd.set("description", description);
    fd.set("lat", String(loc!.lat));
    fd.set("lng", String(loc!.lng));
    fd.set("website", (document.getElementById("website") as HTMLInputElement | null)?.value ?? "");
    if (acknowledgeDuplicate) fd.set("acknowledgeDuplicate", "true");
    if (photo) fd.set("photo", photo);

    setSubmitting(true);
    try {
      const res = await fetch("/api/issues", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (res.status === 201) {
        setSuccess(body);
        window.scrollTo({ top: 0 });
        return;
      }
      if (res.status === 409 && body?.error?.details?.duplicates) {
        setDuplicates(body.error.details.duplicates);
        return;
      }
      const fields: Errors = body?.error?.fields ?? {};
      if (fields.lat || fields.lng) fields.location = fields.lat ?? fields.lng!;
      setErrors(fields);
      setFormError(body?.error?.message ?? t.common.errorGeneric);
      requestAnimationFrame(() => errorRef.current?.focus());
    } catch {
      setFormError(t.common.errorNetwork);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    const pending = success.moderationState !== "visible";
    return (
      <div className="card p-6 text-center" role="status">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-700">
          <Icon name="checkCircle" size={30} />
        </div>
        <h2 className="mt-4 text-xl font-bold">{t.report.successTitle}</h2>
        <p className="mt-2 text-ink-muted">{pending ? t.report.successPending : t.report.successBody}</p>
        {success.photoPending && <p className="mt-1 text-sm text-ink-muted">{t.report.photoReview}</p>}
        <div className="mx-auto mt-6 max-w-sm rounded-xl bg-canvas p-4 text-left">
          <p className="text-sm font-semibold">{t.report.nextSteps}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
            <li>{t.report.next1}</li>
            <li>{t.report.next2}</li>
            <li>{t.report.next3}</li>
          </ol>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href={`/issues/${success.id}`}>{t.report.viewReport}</ButtonLink>
          {!pending && <ShareButton path={`/issues/${success.id}`} title={title} variant="button" />}
          <Button variant="ghost" onClick={() => window.location.reload()}>
            {t.report.reportAnother}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
      className="space-y-6"
    >
      {formError && (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Notice tone="danger" role="alert">
            {formError}
          </Notice>
        </div>
      )}

      {/* Step 1: what */}
      <section className="card space-y-5 p-5" aria-labelledby="step-what">
        <h2 id="step-what" className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-xs text-white">1</span>
          {t.report.stepWhat}
        </h2>
        <fieldset aria-describedby={errors.category ? "category-error" : undefined}>
          <legend className="text-sm font-medium">{t.report.category}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <label
                  key={c.id}
                  className={cn(
                    "flex min-h-[56px] cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600",
                    on ? "border-brand-600 bg-brand-50 text-brand-900" : "border-line bg-white hover:bg-canvas",
                  )}
                >
                  <input type="radio" name="category" value={c.id} checked={on} onChange={() => setCategory(c.id)} className="sr-only" />
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: c.color }} aria-hidden="true">
                    <Icon name={c.icon} size={16} />
                  </span>
                  <span className="leading-tight">{c.label[locale]}</span>
                </label>
              );
            })}
          </div>
          {errors.category && (
            <p id="category-error" className="mt-1.5 text-xs font-medium text-red-700">
              {errors.category}
            </p>
          )}
        </fieldset>

        <Field id="title" label={t.report.shortTitle} hint={t.report.shortTitleHint} error={errors.title}>
          <input
            id="title"
            className={inputClass}
            value={title}
            maxLength={R.titleMax}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!errors.title}
            aria-describedby={describedBy("title", errors.title, t.report.shortTitleHint)}
            autoComplete="off"
            required
          />
        </Field>
        <p className="-mt-3 text-right text-xs text-ink-faint" aria-hidden="true">
          {title.length}/{R.titleMax}
        </p>

        <Field id="description" label={t.report.description} optionalLabel={t.common.optional} hint={t.report.descriptionHint} error={errors.description}>
          <textarea
            id="description"
            rows={4}
            className={inputClass}
            value={description}
            maxLength={R.descriptionMax}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!errors.description}
            aria-describedby={describedBy("description", errors.description, t.report.descriptionHint)}
          />
        </Field>
        <p className="-mt-3 text-right text-xs text-ink-faint" aria-hidden="true">
          {description.length}/{R.descriptionMax}
        </p>
      </section>

      {/* Step 2: where */}
      <section className="card space-y-4 p-5" aria-labelledby="step-where">
        <h2 id="step-where" className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-xs text-white">2</span>
          {t.report.stepWhere}
        </h2>
        <p className="text-sm text-ink-muted">{t.report.locationHint}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={useMyLocation} disabled={locating}>
            <Icon name="locate" size={16} />
            {locating ? t.common.locating : t.common.useMyLocation}
          </Button>
        </div>
        {locMsg && <p role="status" className="text-sm text-amber-800">{locMsg}</p>}
        <div className={cn("h-72 overflow-hidden rounded-xl border sm:h-80", errors.location ? "border-red-600" : "border-line")}>
          <LocationPicker value={loc} onChange={setLoc} flyKey={flyKey} ariaLabel={t.report.location} />
        </div>
        {errors.location && <p className="text-xs font-medium text-red-700" role="alert">{errors.location}</p>}
        <details className="rounded-xl border border-line bg-canvas px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">{t.report.manualCoords}</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field id="lat" label={t.report.latitude}>
              <input
                id="lat"
                inputMode="decimal"
                className={inputClass}
                value={loc?.lat ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setLoc((p) => ({ lat: v, lng: p?.lng ?? APP_CONFIG.defaultCenter.lng }));
                }}
                onBlur={() => setFlyKey(String(Date.now()))}
              />
            </Field>
            <Field id="lng" label={t.report.longitude}>
              <input
                id="lng"
                inputMode="decimal"
                className={inputClass}
                value={loc?.lng ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setLoc((p) => ({ lng: v, lat: p?.lat ?? APP_CONFIG.defaultCenter.lat }));
                }}
                onBlur={() => setFlyKey(String(Date.now()))}
              />
            </Field>
          </div>
        </details>
        <Notice tone="info">{fmt(t.report.publicLocationNote, { days: APP_CONFIG.privacy.exactLocationRetentionDays })}</Notice>
      </section>

      {/* Step 3: photo */}
      <section className="card space-y-4 p-5" aria-labelledby="step-photo">
        <h2 id="step-photo" className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-xs text-white">3</span>
          {t.report.stepPhoto}
          <span className="text-sm font-normal text-ink-muted">({t.common.optional})</span>
        </h2>

        <Notice tone="warn" title={t.report.privacyTitle}>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>{t.report.privacy1}</li>
            <li>{t.report.privacy2}</li>
            <li>{t.report.privacy3}</li>
            <li>{t.report.privacy4}</li>
          </ul>
        </Notice>

        {preview ? (
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-28 w-28 rounded-xl object-cover" />
            <Button variant="outline" size="sm" onClick={removePhoto}>
              <Icon name="x" size={16} />
              {t.report.removePhoto}
            </Button>
          </div>
        ) : (
          <label
            htmlFor="photo"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-canvas px-4 py-8 text-center hover:border-brand-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600"
          >
            <Icon name="camera" size={28} className="text-brand-700" />
            <span className="text-sm font-medium">{t.report.photo}</span>
            <span className="text-xs text-ink-muted">{fmt(t.report.photoHint, { mb: APP_CONFIG.photos.maxBytes / 1024 / 1024 })}</span>
            <input
              ref={fileRef}
              id="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={onPhoto}
              className="sr-only"
              aria-describedby={errors.photo ? "photo-error" : undefined}
            />
          </label>
        )}
        {errors.photo && (
          <p id="photo-error" className="text-xs font-medium text-red-700">
            {errors.photo}
          </p>
        )}
        <p className="text-xs text-ink-muted">{t.report.photoReview}</p>
      </section>

      {/* Honeypot: hidden from people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {duplicates && (
        <section className="card border-amber-300 p-5" aria-labelledby="dup-title" role="alert">
          <h2 id="dup-title" className="font-semibold text-amber-900">{t.report.duplicateTitle}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t.report.duplicateBody}</p>
          <ul className="mt-3">
            {duplicates.map((d) => (
              <li key={d.id}>
                <IssueCard issue={d} locale={locale} from={loc} />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void submit(true)} disabled={submitting}>
              {t.report.submitAnyway}
            </Button>
          </div>
        </section>
      )}

      <div className="sticky bottom-20 z-10 md:static">
        <Button type="submit" size="lg" className="w-full shadow-fab md:w-auto md:shadow-none" disabled={submitting}>
          {submitting ? t.report.submitting : t.report.submit}
        </Button>
      </div>
      <p className="text-xs text-ink-muted">
        {t.disclaimer.emergency}{" "}
        <Link href="/guidelines" className="underline">
          {t.common.guidelines}
        </Link>
      </p>
    </form>
  );
}
