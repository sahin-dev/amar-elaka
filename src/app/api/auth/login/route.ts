import type { NextRequest } from "next/server";
import { loginSchema } from "@/lib/validation";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { assertSameOrigin, clientKey, handler, json, readJson } from "@/server/http";
import { login } from "@/server/services/accounts";

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const input = await readJson(req, loginSchema);
  const { user, token, expiresAt } = await login(input, { ipKey: clientKey(req) });
  const res = json({ user: { displayName: user.displayName, role: user.role, emailVerified: user.emailVerified } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
});
