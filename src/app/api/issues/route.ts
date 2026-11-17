import type { NextRequest } from "next/server";
import { APP_CONFIG } from "@/config/app-config";
import { AppError } from "@/lib/errors";
import { createReportSchema, listIssuesQuerySchema } from "@/lib/validation";
import { getRequestUser } from "@/server/auth/session";
import { assertSameOrigin, clientKey, handler, json } from "@/server/http";
import { createIssue, listIssues } from "@/server/services/issues";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const q = listIssuesQuerySchema.parse(params);
  const data = await listIssues(q, { withSummary: params.summary === "1" });
  return json(data, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } });
});

const MAX_BODY = APP_CONFIG.photos.maxBytes + 64 * 1024;

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) throw new AppError("PAYLOAD_TOO_LARGE", "The upload is too large.", { fields: { photo: "Photo is too large" } });
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.startsWith("multipart/form-data")) throw new AppError("UNSUPPORTED_MEDIA", "Expected a form submission.");

  const user = await getRequestUser(req);
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to submit a report.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError("VALIDATION", "The form could not be read.");
  }
  const input = createReportSchema.parse({
    category: form.get("category"),
    title: form.get("title"),
    description: form.get("description") ?? "",
    lat: form.get("lat"),
    lng: form.get("lng"),
    acknowledgeDuplicate: form.get("acknowledgeDuplicate") ?? undefined,
    website: form.get("website") ?? "",
  });

  const file = form.get("photo");
  let photo: { bytes: Buffer; mime: string } | null = null;
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > APP_CONFIG.photos.maxBytes) {
      throw new AppError("PAYLOAD_TOO_LARGE", "The photo is too large.", { fields: { photo: "Photo is too large" } });
    }
    photo = { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type };
  }

  const result = await createIssue(input, { user, ipKey: clientKey(req), photo });
  return json(result, 201);
});
