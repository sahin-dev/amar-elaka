import { getDb, isDbConfigured } from "@/server/db";

export const dynamic = "force-dynamic";

/** Liveness + database reachability. Reveals no configuration details. */
export async function GET() {
  if (!isDbConfigured()) return Response.json({ ok: false, db: "not_configured" }, { status: 503 });
  try {
    await (await getDb()).command({ ping: 1 });
    return Response.json({ ok: true, db: "up" });
  } catch {
    return Response.json({ ok: false, db: "unreachable" }, { status: 503 });
  }
}
