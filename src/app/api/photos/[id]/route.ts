import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { getRequestUser, isModerator } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { handler } from "@/server/http";
import { getPhotoForViewer } from "@/server/services/photos";

export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.parse((await ctx.params).id);
  const variant = req.nextUrl.searchParams.get("v") === "thumb" ? "thumb" : "main";
  const viewer = await getRequestUser(req);
  const photo = await getPhotoForViewer(await getDb(), id, variant, isModerator(viewer));
  if (!photo) throw new AppError("NOT_FOUND", "Photo not found.");
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(photo.data.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      // Short public cache so later moderation takes effect quickly; unapproved photos are never shared-cached.
      "Cache-Control": photo.isPublic ? "public, max-age=3600, stale-while-revalidate=86400" : "private, no-store",
    },
  });
});
