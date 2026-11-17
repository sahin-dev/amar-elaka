import { NextRequest } from "next/server";
import { clientKey, getClientIp, handler, json, readJson, assertSameOrigin } from "@/server/http";
import { createPollSchema } from "@/lib/validation";
import { createPoll, listPolls } from "@/server/services/polls";
import { getRequestUser } from "@/server/auth/session";
import { ensurePollDeviceToken, POLL_DEVICE_COOKIE, POLL_DEVICE_COOKIE_OPTIONS } from "@/server/polls/device-token";

export const GET = handler(async (req: NextRequest) => {
  const ip = getClientIp(req);
  const device = ensurePollDeviceToken(req.cookies.get(POLL_DEVICE_COOKIE)?.value);
  const ipKey = ip !== "unknown" || process.env.NODE_ENV !== "production" ? clientKey(req) : "";
  const items = await listPolls(ipKey, device.deviceKey, await getRequestUser(req));
  const response = json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(POLL_DEVICE_COOKIE, device.token, POLL_DEVICE_COOKIE_OPTIONS);
  return response;
});

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const id = await createPoll(await getRequestUser(req), await readJson(req, createPollSchema));
  return json({ id }, 201);
});
