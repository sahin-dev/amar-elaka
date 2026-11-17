import type { NextRequest } from "next/server";
import { getRequestUser } from "@/server/auth/session";
import { handler, json } from "@/server/http";
import { getModerationQueues } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const queues = await getModerationQueues(await getRequestUser(req));
  return json(queues, { headers: { "Cache-Control": "private, no-store" } });
});
