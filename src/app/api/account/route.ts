import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { deleteAccountSchema, updateProfileSchema } from "@/lib/validation";
import { getRequestUser, SESSION_COOKIE } from "@/server/auth/session";
import { assertSameOrigin, handler, json, readJson } from "@/server/http";
import { deleteAccount, updateProfile } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

async function requireUser(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  return user;
}

export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser(req);
  return json({ user }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Updates the signed-in user's own profile only; no user id is accepted from the client. */
export const PATCH = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser(req);
  const patch = await readJson(req, updateProfileSchema);
  await updateProfile(user, patch);
  return json({ ok: true });
});

export const DELETE = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser(req);
  const { password, removeReports } = await readJson(req, deleteAccountSchema);
  await deleteAccount(user, password, removeReports);
  const res = json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
