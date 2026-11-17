import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { assertSameOrigin, clientKey, handler, json } from "@/server/http";
import { getRequestUser } from "@/server/auth/session";
import { resendVerification } from "@/server/services/accounts";

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await getRequestUser(req);
  if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to request a verification email.");
  const sent = await resendVerification(user, { ipKey: clientKey(req) });
  return json({ ok: true, sent });
});
