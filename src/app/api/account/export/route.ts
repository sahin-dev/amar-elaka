import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { getRequestUser } from "@/server/auth/session";
import { handler } from "@/server/http";
import { exportMyData } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const user = await getRequestUser(req);
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  const data = await exportMyData(user);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"amarelaka-my-data.json\"",
      "Cache-Control": "private, no-store",
    },
  });
});
