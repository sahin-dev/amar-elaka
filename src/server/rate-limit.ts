import "server-only";
import type { Collection } from "mongodb";
import { AppError } from "@/lib/errors";
import { isDuplicateKeyError } from "@/server/db";
import type { RateLimitDoc } from "@/server/types";

export interface RateLimitResult {
  ok: boolean;
  count: number;
  limit: number;
  retryAfter: number;
}

/**
 * Fixed-window counter stored in MongoDB so limits hold across serverless
 * instances. Old windows are removed by a TTL index on `expiresAt`.
 */
export async function hitRateLimit(
  col: Collection<RateLimitDoc>,
  key: string,
  [limit, windowSec]: readonly [number, number],
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowMs = windowSec * 1000;
  const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;
  const id = `${key}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowMs);
  const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));

  const run = () =>
    col.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" },
    );

  let doc: RateLimitDoc | null;
  try {
    doc = await run();
  } catch (e) {
    // Two concurrent upserts can race on a fresh window; the retry finds the doc.
    if (!isDuplicateKeyError(e)) throw e;
    doc = await run();
  }
  const count = doc?.count ?? 1;
  return { ok: count <= limit, count, limit, retryAfter };
}

export async function enforceRateLimit(
  col: Collection<RateLimitDoc>,
  key: string,
  rule: readonly [number, number],
  now?: Date,
): Promise<void> {
  const r = await hitRateLimit(col, key, rule, now);
  if (!r.ok) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please wait a little and try again.", {
      retryAfter: r.retryAfter,
    });
  }
}
