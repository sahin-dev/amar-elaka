import "server-only";
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { AppError, type ApiErrorBody } from "@/lib/errors";
import { zodFieldErrors } from "@/lib/validation";

export function json<T>(data: T, init: number | ResponseInit = 200): NextResponse {
  const opts = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, opts);
}

export function errorResponse(e: unknown): NextResponse<ApiErrorBody> {
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Some fields are invalid.", fields: zodFieldErrors(e) } },
      { status: 400 },
    );
  }
  if (e instanceof AppError) {
    const headers: Record<string, string> = {};
    if (e.retryAfter) headers["Retry-After"] = String(e.retryAfter);
    return NextResponse.json(
      { error: { code: e.code, message: e.message, fields: e.fields, details: e.details } },
      { status: e.status, headers },
    );
  }
  // Never leak driver/database internals to clients.
  console.error("[api] unexpected error", e);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

/** Wrap a route handler with consistent error handling. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/**
 * CSRF defence for state-changing requests: require an Origin header that
 * matches this site. Combined with SameSite=Lax session cookies.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) throw new AppError("BAD_ORIGIN", "Missing request origin.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("BAD_ORIGIN", "Invalid request origin.");
  }
  const allowed = new Set<string>();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) allowed.add(host);
  try {
    allowed.add(new URL(req.url).host);
  } catch {
    /* ignore */
  }
  if (process.env.APP_URL) {
    try {
      allowed.add(new URL(process.env.APP_URL).host);
    } catch {
      /* ignore */
    }
  }
  if (!allowed.has(originHost)) throw new AppError("BAD_ORIGIN", "Cross-site request blocked.");
}

const MAX_JSON_BYTES = 32 * 1024;

export async function readJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_JSON_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Request is too large.");
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_JSON_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Request is too large.");
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("VALIDATION", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

function ipSecret(): string {
  const s = process.env.IP_HASH_SECRET;
  if (s && s.length >= 16 && !s.includes("<")) return s;
  if (process.env.NODE_ENV === "production") {
    throw new AppError("UNAVAILABLE", "Server is not fully configured (IP_HASH_SECRET).");
  }
  return "dev-only-insecure-ip-secret";
}

export function getClientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "true") {
    const xff = req.headers.get("x-forwarded-for");
    const first = xff?.split(",")[0]?.trim();
    if (first) return first;
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return "unknown";
}

/** Keyed hash of the client IP. Raw IPs are never stored. */
export function clientKey(req: Request): string {
  return createHmac("sha256", ipSecret()).update(getClientIp(req)).digest("hex").slice(0, 32);
}
