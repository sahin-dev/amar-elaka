import type { Db, Document } from "mongodb";

const uuid = { bsonType: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" };
const date = { bsonType: "date" };

export async function up(db: Db): Promise<void> {
  const votes = db.collection("poll_votes");
  // Preserve pre-account votes under a unique legacy key.
  await votes.updateMany({ accountKey: { $exists: false } }, [{ $set: { accountKey: "$deviceKey" } }]);
  const schema: Document = {
    bsonType: "object",
    required: ["_id", "pollId", "voterKey", "deviceKey", "accountKey", "optionId", "createdAt"],
    properties: {
      _id: uuid,
      pollId: uuid,
      voterKey: { bsonType: "string", minLength: 32, maxLength: 32 },
      deviceKey: { bsonType: "string", minLength: 32, maxLength: 32 },
      accountKey: { bsonType: "string", minLength: 32, maxLength: 32 },
      optionId: uuid,
      createdAt: date,
    },
  };
  await db.command({ collMod: "poll_votes", validator: { $jsonSchema: schema }, validationLevel: "strict", validationAction: "error" });
  await votes.createIndex({ pollId: 1, accountKey: 1 }, { name: "one_vote_per_account_per_poll", unique: true });
}
