import { NextRequest } from "next/server";
import { handler, json, readJson, assertSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";
import { pollStatusSchema, uuidSchema } from "@/lib/validation";
import { changePollStatus } from "@/server/services/polls";
import { getRequestUser } from "@/server/auth/session";

export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) throw new AppError("NOT_FOUND", "Poll not found.");
  const { status } = await readJson(req, pollStatusSchema);
  await changePollStatus(await getRequestUser(req), parsedId.data, status);
  return json({ ok: true });
});
