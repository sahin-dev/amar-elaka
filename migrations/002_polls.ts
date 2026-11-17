import type { Db, Document } from "mongodb";

const date = { bsonType: "date" };
const nullable = (type: string) => ({ bsonType: [type, "null"] });
const uuid = { bsonType: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" };

export async function up(db: Db): Promise<void> {
  const pollsSchema: Document = {
    bsonType: "object",
    required: ["_id", "topic", "question", "context", "sourceUrl", "options", "status", "voteGate", "closesAt", "createdBy", "createdAt", "updatedAt"],
    properties: {
      _id: uuid,
      topic: { enum: ["government", "society", "local", "other"] },
      question: { bsonType: "string", minLength: 8, maxLength: 180 },
      context: { bsonType: "string", maxLength: 1000 },
      sourceUrl: nullable("string"),
      options: {
        bsonType: "array", minItems: 2, maxItems: 5,
        items: { bsonType: "object", required: ["id", "text"], properties: { id: uuid, text: { bsonType: "string", minLength: 1, maxLength: 80 } } },
      },
      status: { enum: ["open", "closed"] },
      voteGate: { bsonType: "int", minimum: 0 },
      closesAt: nullable("date"),
      createdBy: uuid,
      createdAt: date,
      updatedAt: date,
    },
  };
  const votesSchema: Document = {
    bsonType: "object",
    required: ["_id", "pollId", "voterKey", "optionId", "createdAt"],
    properties: { _id: uuid, pollId: uuid, voterKey: { bsonType: "string", minLength: 32, maxLength: 32 }, deviceKey: { bsonType: "string", minLength: 32, maxLength: 32 }, optionId: uuid, createdAt: date },
  };
  const eventsSchema: Document = {
    bsonType: "object", required: ["_id", "pollId", "actorId", "action", "createdAt"],
    properties: { _id: uuid, pollId: uuid, actorId: uuid, action: { enum: ["created", "closed", "reopened"] }, createdAt: date },
  };
  for (const [name, schema] of [["polls", pollsSchema], ["poll_votes", votesSchema], ["poll_events", eventsSchema]] as const) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) await db.createCollection(name, { validator: { $jsonSchema: schema }, validationLevel: "strict", validationAction: "error" });
    else await db.command({ collMod: name, validator: { $jsonSchema: schema }, validationLevel: "strict", validationAction: "error" });
  }
  await db.collection("polls").createIndexes([
    { key: { status: 1, createdAt: -1 }, name: "status_created" },
    { key: { createdBy: 1, createdAt: -1 }, name: "creator_created" },
  ]);
  await db.collection("poll_votes").createIndexes([
    { key: { pollId: 1, voterKey: 1 }, name: "one_vote_per_ip_per_poll", unique: true },
    { key: { pollId: 1, optionId: 1 }, name: "poll_option" },
  ]);
  await db.collection("poll_events").createIndexes([{ key: { pollId: 1, createdAt: -1 }, name: "poll_created" }]);
}
