import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";

const DEV_SECRET = "dev-only-insecure-ip-secret";

function secret(): string {
  const value = process.env.IP_HASH_SECRET;
  if (value && value.length >= 16 && !value.includes("<")) return value;
  if (process.env.NODE_ENV === "production") {
    throw new AppError("UNAVAILABLE", "Server is not fully configured (IP_HASH_SECRET).");
  }
  return DEV_SECRET;
}

function signature(id: string): string {
  return createHmac("sha256", secret()).update(`poll-device-token:${id}`).digest("base64url");
}

/** Create/validate a signed browser token; persist only its keyed hash. */
export function ensurePollDeviceToken(raw: string | undefined): { token: string; deviceKey: string } {
  let id: string | null = null;
  if (raw && raw.length <= 100) {
    const [candidate, supplied, extra] = raw.split(".");
    if (!extra && candidate && supplied && /^[A-Za-z0-9_-]{43}$/.test(candidate) && /^[A-Za-z0-9_-]{43}$/.test(supplied)) {
      const expectedBytes = Buffer.from(signature(candidate));
      const suppliedBytes = Buffer.from(supplied);
      if (expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)) id = candidate;
    }
  }
  if (!id) id = randomBytes(32).toString("base64url");
  const key = createHmac("sha256", secret()).update(`poll-device-key:${id}`).digest("hex").slice(0, 32);
  return { token: `${id}.${signature(id)}`, deviceKey: key };
}

export const POLL_DEVICE_COOKIE = "ae_poll_device";
export const POLL_DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/polls",
  maxAge: 60 * 60 * 24 * 365,
};
