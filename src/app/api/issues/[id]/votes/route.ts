import type { NextRequest } from "next/server";
import { uuidSchema, voteSchema } from "@/lib/validation";
import { getRequestUser } from "@/server/auth/session";
import { assertSameOrigin, clientKey, handler, json, readJson } from "@/server/http";
import { castVote } from "@/server/services/community";

export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const id = uuidSchema.parse((await ctx.params).id);
  const { kind } = await readJson(req, voteSchema);
  const result = await castVote(id, kind, { user: await getRequestUser(req), guestKey: clientKey(req) });
  return json(result);
});
