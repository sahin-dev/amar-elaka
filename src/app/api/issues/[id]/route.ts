import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { getRequestUser } from "@/server/auth/session";
import { handler, json } from "@/server/http";
import { getIssueForViewer, getIssueHistory } from "@/server/services/issues";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.parse((await ctx.params).id);
  const issue = await getIssueForViewer(id, await getRequestUser(req));
  if (!issue) throw new AppError("NOT_FOUND", "Report not found.");
  const history = await getIssueHistory(id);
  return json({ issue, history }, { headers: { "Cache-Control": "private, no-store" } });
});
