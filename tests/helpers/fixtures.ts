import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { runMigrations } from "../../migrations";
import { hashPassword } from "@/server/auth/password";
import { createSession, SESSION_COOKIE, type SessionUser } from "@/server/auth/session";
import { collections, getDb } from "@/server/db";
import type { Role } from "@/server/types";
import type { CreateReportInput } from "@/lib/validation";
import { createIssue } from "@/server/services/issues";

export const ORIGIN = "http://localhost:3000";

/** Mirpur-ish test area polygon. */
export const TEST_AREA = {
  _id: "00000000-0000-4000-8000-000000000001",
  slug: "test-mirpur",
  name: { en: "Test Mirpur", bn: "টেস্ট মিরপুর" },
  city: { en: "Dhaka", bn: "ঢাকা" },
  center: { type: "Point" as const, coordinates: [90.365, 23.805] as [number, number] },
  boundary: {
    type: "Polygon" as const,
    coordinates: [[[90.34, 23.79], [90.39, 23.79], [90.39, 23.83], [90.34, 23.83], [90.34, 23.79]]],
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export async function resetDb() {
  const db = await getDb();
  await db.dropDatabase();
  await runMigrations(db);
  await collections(db).areas.insertOne({ ...TEST_AREA });
}

let counter = 0;
export async function makeUser(role: Role = "resident", password = "correct horse battery"): Promise<SessionUser & { token: string; password: string }> {
  const c = collections(await getDb());
  const id = randomUUID();
  const email = `user${++counter}-${id.slice(0, 6)}@example.test`;
  await c.profiles.insertOne({
    _id: id,
    email,
    passwordHash: await hashPassword(password),
    displayName: `User ${counter}`,
    role,
    locale: "en",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  });
  const { token } = await createSession(id);
  return { id, email, displayName: `User ${counter}`, role, locale: "en", token, password };
}

export function req(
  path: string,
  opts: { method?: string; json?: unknown; body?: BodyInit; token?: string; origin?: string | null; ip?: string; headers?: Record<string, string> } = {},
): NextRequest {
  const headers: Record<string, string> = { host: "localhost:3000", ...(opts.headers ?? {}) };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  let body = opts.body;
  if (opts.json !== undefined) {
    body = JSON.stringify(opts.json);
    headers["content-type"] = "application/json";
  }
  return new NextRequest(new URL(path, ORIGIN), { method: opts.method ?? "GET", headers, body });
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

export const baseReport = (over: Partial<CreateReportInput> = {}): CreateReportInput => ({
  category: "pothole",
  title: "Deep pothole near the bus stop",
  description: "Large pothole, motorbikes swerving around it.",
  lat: 23.80123,
  lng: 90.36789,
  acknowledgeDuplicate: false,
  website: "",
  ...over,
});

export async function makeIssue(reporter: SessionUser, over: Partial<CreateReportInput> = {}) {
  return createIssue(baseReport({ acknowledgeDuplicate: true, ...over }), { user: reporter, ipKey: "test-ip" });
}
