import type { NextRequest } from "next/server";
import { photoModerationSchema, uuidSchema } from "@/lib/validation";
import { getRequestUser } from "@/server/auth/session";
import { assertSameOrigin, handler, json, readJson } from "@/server/http";
import { moderatePhoto } from "@/server/services/moderation";

export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const id = uuidSchema.parse((await ctx.params).id);
  const user = await getRequestUser(req);
  const { decision, note } = await readJson(req, photoModerationSchema);
  await moderatePhoto(user, id, decision, note);
  return json({ ok: true });
});
