import type { NextRequest } from "next/server";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/i18n";
import { assertSameOrigin, handler, json, readJson } from "@/server/http";

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const { locale } = await readJson(req, z.object({ locale: z.enum(["en", "bn"]) }));
  const res = json({ ok: true });
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
});
