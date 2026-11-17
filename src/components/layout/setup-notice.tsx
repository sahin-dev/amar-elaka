import { Notice } from "@/components/ui/states";

/** Shown instead of data views when MONGODB_URI is missing (local setup aid). */
export function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Notice tone="warn" title="Database not configured">
        <p>
          Set <code className="rounded bg-amber-100 px-1">MONGODB_URI</code> in <code className="rounded bg-amber-100 px-1">.env.local</code>,
          then run <code className="rounded bg-amber-100 px-1">npm run db:migrate</code> and{" "}
          <code className="rounded bg-amber-100 px-1">npm run db:seed:areas</code>. See README → Setup.
        </p>
      </Notice>
    </div>
  );
}
