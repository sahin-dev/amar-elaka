import type { NextRequest } from "next/server";
import { getRequestUser } from "@/server/auth/session";
import { handler, json } from "@/server/http";
import { listAuditLog } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const events = await listAuditLog(await getRequestUser(req), 100);
  return json({ events }, { headers: { "Cache-Control": "private, no-store" } });
});
