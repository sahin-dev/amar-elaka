import type { NextRequest } from "next/server";
import { deleteSession, SESSION_COOKIE } from "@/server/auth/session";
import { assertSameOrigin, handler, json } from "@/server/http";

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  const res = json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
