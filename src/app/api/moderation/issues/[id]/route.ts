import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { moderationActionSchema, uuidSchema } from "@/lib/validation";
import { getRequestUser } from "@/server/auth/session";
import { assertSameOrigin, handler, json, readJson } from "@/server/http";
import { applyModerationAction, getModerationIssue } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.parse((await ctx.params).id);
  const data = await getModerationIssue(await getRequestUser(req), id);
  if (!data) throw new AppError("NOT_FOUND", "Report not found.");
  return json(data, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const id = uuidSchema.parse((await ctx.params).id);
  const user = await getRequestUser(req);
  const input = await readJson(req, moderationActionSchema);
  const result = await applyModerationAction(user, id, input);
  return json(result);
});
