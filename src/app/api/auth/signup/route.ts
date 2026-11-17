import type { NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n";
import { signupSchema } from "@/lib/validation";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { assertSameOrigin, clientKey, handler, json, readJson } from "@/server/http";
import { signup } from "@/server/services/accounts";

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const input = await readJson(req, signupSchema);
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const { user, token, expiresAt, verificationSent } = await signup(input, {
    ipKey: clientKey(req),
    locale: isLocale(cookieLocale) ? cookieLocale : "bn",
  });
  const res = json({ user: { displayName: user.displayName, role: user.role, emailVerified: user.emailVerified }, verificationSent }, 201);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
});
