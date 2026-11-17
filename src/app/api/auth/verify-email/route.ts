import { verifyEmailSchema } from "@/lib/validation";
import { assertSameOrigin, handler, json, readJson } from "@/server/http";
import { verifyEmail } from "@/server/services/accounts";

export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const { token } = await readJson(req, verifyEmailSchema);
  await verifyEmail(token);
  return json({ ok: true });
});
