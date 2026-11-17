/**
 * Grant or revoke moderator access. There is deliberately no UI or API for
 * this: role changes require database access.
 *
 *   npm run user:role -- someone@example.com moderator
 *   npm run user:role -- someone@example.com resident
 */
import { randomUUID } from "node:crypto";
import { connect } from "./lib/connect";

const ROLES = ["resident", "moderator", "admin"];

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !ROLES.includes(role)) {
    console.error(`Usage: npm run user:role -- <email> <${ROLES.join("|")}>`);
    process.exit(1);
  }
  const { client, db } = await connect();
  try {
    const profiles = db.collection<{ _id: string; email: string; role: string }>("profiles");
    const user = await profiles.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      console.error("No account with that email. The person must sign up first.");
      process.exit(1);
    }
    await profiles.updateOne({ _id: user._id }, { $set: { role, updatedAt: new Date() } });
    await db.collection("moderation_events").insertOne({
      _id: randomUUID() as unknown as never,
      issueId: null,
      targetType: "user",
      targetId: user._id,
      action: "role_change",
      actorId: "system",
      from: user.role,
      to: role,
      note: "Changed via scripts/set-role.ts",
      createdAt: new Date(),
    });
    console.log(`Role for ${email}: ${user.role} → ${role}`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
