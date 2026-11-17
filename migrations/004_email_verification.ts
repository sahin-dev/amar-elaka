import type { Db, Document } from "mongodb";

const uuid = { bsonType: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" };
const date = { bsonType: "date" };
const nullable = (type: string) => ({ bsonType: [type, "null"] });

export async function up(db: Db): Promise<void> {
  const profiles = db.collection("profiles");
  // Existing accounts predate email verification; keep them usable.
  await profiles.updateMany(
    { emailVerifiedAt: { $exists: false } },
    [{ $set: { emailVerifiedAt: "$createdAt", emailVerificationTokenHash: null, emailVerificationExpiresAt: null } }],
  );
  const schema: Document = {
    bsonType: "object",
    required: ["_id", "email", "passwordHash", "role", "locale", "createdAt", "updatedAt", "emailVerifiedAt", "emailVerificationTokenHash", "emailVerificationExpiresAt"],
    properties: {
      _id: uuid,
      email: { bsonType: "string", maxLength: 254 },
      passwordHash: { bsonType: "string", pattern: "^scrypt\\$" },
      displayName: { bsonType: "string", maxLength: 40 },
      role: { enum: ["resident", "moderator", "admin"] },
      locale: { enum: ["en", "bn"] },
      createdAt: date,
      updatedAt: date,
      lastLoginAt: nullable("date"),
      emailVerifiedAt: nullable("date"),
      emailVerificationTokenHash: nullable("string"),
      emailVerificationExpiresAt: nullable("date"),
    },
  };
  await db.command({ collMod: "profiles", validator: { $jsonSchema: schema }, validationLevel: "strict", validationAction: "error" });
  await profiles.createIndex(
    { emailVerificationTokenHash: 1 },
    { name: "email_verification_token_unique", unique: true, partialFilterExpression: { emailVerificationTokenHash: { $type: "string" } } },
  );
}
