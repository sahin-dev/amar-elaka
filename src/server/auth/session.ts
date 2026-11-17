import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { APP_CONFIG } from "@/config/app-config";
import { getCollections, isDbConfigured } from "@/server/db";
import type { ProfileDoc, Role } from "@/server/types";
import type { Locale } from "@/i18n";

export const SESSION_COOKIE = "ae_session";

/** What the server knows about the signed-in person. Never sent to other users. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  locale: Locale;
  emailVerified: boolean;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

function toSessionUser(p: ProfileDoc): SessionUser {
  return { id: p._id, email: p.email, displayName: p.displayName, role: p.role, locale: p.locale, emailVerified: !!p.emailVerifiedAt };
}

/** Create a session and return the raw token (store only its hash). */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + APP_CONFIG.session.days * 86_400_000);
  const { sessions } = await getCollections();
  await sessions.insertOne({ _id: hashToken(token), userId, createdAt: now, expiresAt });
  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  const { sessions } = await getCollections();
  await sessions.deleteOne({ _id: hashToken(token) });
}

export async function getUserFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const { sessions, profiles } = await getCollections();
  const s = await sessions.findOne({ _id: hashToken(token) });
  if (!s || s.expiresAt <= new Date()) return null;
  const p = await profiles.findOne({ _id: s.userId });
  return p ? toSessionUser(p) : null;
}

/** For route handlers. */
export async function getRequestUser(req: NextRequest | Request): Promise<SessionUser | null> {
  const token =
    "cookies" in req && typeof (req as NextRequest).cookies?.get === "function"
      ? (req as NextRequest).cookies.get(SESSION_COOKIE)?.value
      : parseCookie(req.headers.get("cookie"), SESSION_COOKIE);
  return getUserFromToken(token);
}

/** For server components / pages. Returns null if the DB is unavailable. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!isDbConfigured()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await getUserFromToken(token);
  } catch (e) {
    console.error("[session] lookup failed", e instanceof Error ? e.message : e);
    return null;
  }
}

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function isModerator(user: SessionUser | null): boolean {
  return !!user && (user.role === "moderator" || user.role === "admin");
}
