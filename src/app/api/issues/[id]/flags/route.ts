import type { NextRequest } from "next/server";
import { flagSchema, uuidSchema } from "@/lib/validation";
import { getRequestUser } from "@/server/auth/session";
import { assertSameOrigin, clientKey, handler, json, readJson } from "@/server/http";
import { createFlag } from "@/server/services/community";

export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const id = uuidSchema.parse((await ctx.params).id);
  const { reason, details } = await readJson(req, flagSchema);
  const result = await createFlag(id, reason, details, { user: await getRequestUser(req), guestKey: clientKey(req) });
  return json({ ok: true, ...result }, 201);
});
