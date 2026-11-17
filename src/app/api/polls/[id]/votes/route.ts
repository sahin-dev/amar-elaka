import { NextRequest } from "next/server";
import { clientKey, getClientIp, handler, json, readJson, assertSameOrigin } from "@/server/http";
import { AppError } from "@/lib/errors";
import { uuidSchema, pollVoteSchema } from "@/lib/validation";
import { voteInPoll } from "@/server/services/polls";
import { getRequestUser } from "@/server/auth/session";
import { ensurePollDeviceToken, POLL_DEVICE_COOKIE, POLL_DEVICE_COOKIE_OPTIONS } from "@/server/polls/device-token";

export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) throw new AppError("NOT_FOUND", "Poll not found.");
  const ip = getClientIp(req);
  if (process.env.NODE_ENV === "production" && ip === "unknown") {
    throw new AppError("UNAVAILABLE", "Poll voting needs a verified client IP. Set TRUST_PROXY=true behind your trusted hosting proxy.");
  }
  const { optionId } = await readJson(req, pollVoteSchema);
  const device = ensurePollDeviceToken(req.cookies.get(POLL_DEVICE_COOKIE)?.value);
  await voteInPoll(parsedId.data, await getRequestUser(req), clientKey(req), device.deviceKey, optionId);
  const response = json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(POLL_DEVICE_COOKIE, device.token, POLL_DEVICE_COOKIE_OPTIONS);
  return response;
});
