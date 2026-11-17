import type { Db, Document } from "mongodb";

/**
 * 001 — initial schema.
 *
 * Creates every collection with a $jsonSchema validator (the database rejects
 * malformed documents even if application code has a bug) and the indexes
 * the app relies on, including unique constraints that prevent duplicate
 * votes/flags at the database level.
 */

const str = { bsonType: "string" };
const date = { bsonType: "date" };
const nullable = (t: string) => ({ bsonType: [t, "null"] });
const uuid = { bsonType: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" };
const point = {
  bsonType: "object",
  required: ["type", "coordinates"],
  properties: {
    type: { enum: ["Point"] },
    coordinates: { bsonType: "array", minItems: 2, maxItems: 2, items: { bsonType: ["double", "int", "long", "decimal"] } },
  },
};
const statusEnum = { enum: ["reported", "community_verified", "under_review", "community_resolved", "archived"] };
const modStateEnum = { enum: ["visible", "pending", "hidden", "rejected", "merged", "removed"] };
const categoryEnum = { enum: ["waterlogging", "pothole", "streetlight", "garbage", "blocked_road", "other"] };

const schemas: Record<string, Document> = {
  areas: {
    bsonType: "object",
    required: ["_id", "slug", "name", "city", "center", "boundary", "isActive", "createdAt", "updatedAt"],
    properties: {
      _id: uuid,
      slug: { bsonType: "string", pattern: "^[a-z0-9-]{2,80}$" },
      name: { bsonType: "object", required: ["en", "bn"], properties: { en: str, bn: str } },
      city: { bsonType: "object", required: ["en", "bn"], properties: { en: str, bn: str } },
      center: point,
      boundary: { bsonType: "object", required: ["type", "coordinates"], properties: { type: { enum: ["Polygon"] } } },
      isActive: { bsonType: "bool" },
      createdAt: date,
      updatedAt: date,
    },
  },
  profiles: {
    bsonType: "object",
    required: ["_id", "email", "passwordHash", "role", "locale", "createdAt", "updatedAt"],
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
    },
  },
  sessions: {
    bsonType: "object",
    required: ["_id", "userId", "createdAt", "expiresAt"],
    properties: { _id: { bsonType: "string", minLength: 64, maxLength: 64 }, userId: uuid, createdAt: date, expiresAt: date },
  },
  issues: {
    bsonType: "object",
    required: [
      "_id", "category", "title", "description", "location", "status", "moderationState", "round",
      "counts", "createdAt", "updatedAt", "lastActivityAt",
    ],
    properties: {
      _id: uuid,
      category: categoryEnum,
      title: { bsonType: "string", minLength: 1, maxLength: 100 },
      description: { bsonType: "string", maxLength: 1000 },
      location: point,
      areaId: nullable("string"),
      status: statusEnum,
      moderationState: modStateEnum,
      round: { bsonType: "int", minimum: 0 },
      counts: {
        bsonType: "object",
        required: ["present", "fixed", "openFlags"],
        properties: {
          present: { bsonType: "int", minimum: 0 },
          fixed: { bsonType: "int", minimum: 0 },
          openFlags: { bsonType: "int", minimum: 0 },
        },
      },
      createdAt: date,
      updatedAt: date,
      lastConfirmedAt: nullable("date"),
      lastActivityAt: date,
      resolvedAt: nullable("date"),
      mergedInto: nullable("string"),
      possibleDuplicateOf: { bsonType: "array", items: str },
      publicPhotoId: nullable("string"),
      photoPending: { bsonType: "bool" },
      previousStatus: { bsonType: ["string", "null"] },
    },
  },
  issue_private: {
    bsonType: "object",
    required: ["_id", "reporterIpKey", "createdAt"],
    properties: { _id: uuid, reporterId: nullable("string"), reporterIpKey: str, createdAt: date },
  },
  issue_exact_locations: {
    bsonType: "object",
    required: ["_id", "location", "expiresAt"],
    properties: { _id: uuid, location: point, expiresAt: date },
  },
  issue_photos: {
    bsonType: "object",
    required: ["_id", "issueId", "fileId", "thumbFileId", "width", "height", "bytes", "moderationState", "createdAt"],
    properties: {
      _id: uuid,
      issueId: uuid,
      fileId: { bsonType: "objectId" },
      thumbFileId: { bsonType: "objectId" },
      width: { bsonType: "int", minimum: 1 },
      height: { bsonType: "int", minimum: 1 },
      bytes: { bsonType: "int", minimum: 1 },
      moderationState: { enum: ["pending", "approved", "rejected"] },
      uploadedBy: nullable("string"),
      createdAt: date,
      reviewedAt: nullable("date"),
    },
  },
  issue_updates: {
    bsonType: "object",
    required: ["_id", "issueId", "type", "actorKind", "createdAt"],
    properties: {
      _id: uuid,
      issueId: uuid,
      type: {
        enum: [
          "created", "confirmed_present", "reported_fixed", "status_changed", "reopened", "merged",
          "merged_from", "archived", "restored", "under_review", "review_cleared", "photo_added",
        ],
      },
      actorKind: { enum: ["community", "moderator", "system"] },
      fromStatus: { bsonType: ["string", "null"] },
      toStatus: { bsonType: ["string", "null"] },
      createdAt: date,
    },
  },
  issue_votes: {
    bsonType: "object",
    required: ["_id", "issueId", "round", "voterKey", "kind", "createdAt"],
    properties: {
      _id: uuid,
      issueId: uuid,
      round: { bsonType: "int", minimum: 0 },
      voterKey: { bsonType: "string", pattern: "^[ugd]:" },
      userId: nullable("string"),
      kind: { enum: ["present", "fixed"] },
      createdAt: date,
    },
  },
  issue_flags: {
    bsonType: "object",
    required: ["_id", "issueId", "reason", "flaggerKey", "state", "createdAt"],
    properties: {
      _id: uuid,
      issueId: uuid,
      reason: {
        enum: ["inaccurate", "duplicate", "personal_info", "offensive", "spam", "wrong_location", "correction_request", "other"],
      },
      details: { bsonType: "string", maxLength: 500 },
      flaggerKey: str,
      userId: nullable("string"),
      state: { enum: ["open", "dismissed", "actioned"] },
      createdAt: date,
      resolvedAt: nullable("date"),
    },
  },
  moderation_events: {
    bsonType: "object",
    required: ["_id", "targetType", "targetId", "action", "actorId", "createdAt"],
    properties: {
      _id: uuid,
      issueId: nullable("string"),
      targetType: { enum: ["issue", "photo", "flag", "user"] },
      targetId: str,
      action: str,
      actorId: str,
      from: nullable("string"),
      to: nullable("string"),
      note: { bsonType: "string", maxLength: 1000 },
      createdAt: date,
    },
  },
  rate_limits: {
    bsonType: "object",
    required: ["_id", "count", "expiresAt"],
    properties: { _id: str, count: { bsonType: ["int", "long"] }, expiresAt: date },
  },
};

async function ensureCollection(db: Db, name: string, schema: Document) {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  const validator = { $jsonSchema: schema };
  if (!exists) {
    await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
  } else {
    await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
  }
}

export async function up(db: Db): Promise<void> {
  for (const [name, schema] of Object.entries(schemas)) {
    await ensureCollection(db, name, schema);
  }

  await db.collection("areas").createIndexes([
    { key: { slug: 1 }, name: "slug_unique", unique: true },
    { key: { boundary: "2dsphere" }, name: "boundary_2dsphere" },
  ]);

  await db.collection("profiles").createIndexes([
    { key: { email: 1 }, name: "email_unique", unique: true },
    { key: { role: 1 }, name: "role" },
  ]);

  await db.collection("sessions").createIndexes([
    { key: { userId: 1 }, name: "userId" },
    { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
  ]);

  await db.collection("issues").createIndexes([
    { key: { location: "2dsphere" }, name: "location_2dsphere" },
    { key: { moderationState: 1, status: 1, lastActivityAt: -1 }, name: "mod_status_activity" },
    { key: { areaId: 1, moderationState: 1, lastActivityAt: -1 }, name: "area_mod_activity" },
    { key: { category: 1, moderationState: 1, lastActivityAt: -1 }, name: "category_mod_activity" },
    { key: { createdAt: -1 }, name: "createdAt" },
    { key: { status: 1 }, name: "status" },
    { key: { "counts.openFlags": -1 }, name: "openFlags", partialFilterExpression: { "counts.openFlags": { $gt: 0 } } },
  ]);

  await db.collection("issue_private").createIndexes([{ key: { reporterId: 1 }, name: "reporterId" }]);

  await db.collection("issue_exact_locations").createIndexes([
    { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
  ]);

  await db.collection("issue_photos").createIndexes([
    { key: { issueId: 1, createdAt: 1 }, name: "issue_created" },
    { key: { moderationState: 1, createdAt: 1 }, name: "state_created" },
  ]);

  await db.collection("issue_updates").createIndexes([{ key: { issueId: 1, createdAt: 1 }, name: "issue_created" }]);

  await db.collection("issue_votes").createIndexes([
    // Database-level guarantee: one vote of each kind per voter per round.
    { key: { issueId: 1, round: 1, voterKey: 1, kind: 1 }, name: "one_vote_per_round", unique: true },
    { key: { userId: 1 }, name: "userId", partialFilterExpression: { userId: { $type: "string" } } },
  ]);

  await db.collection("issue_flags").createIndexes([
    { key: { issueId: 1, flaggerKey: 1 }, name: "one_flag_per_issue", unique: true },
    { key: { state: 1, createdAt: 1 }, name: "state_created" },
    { key: { userId: 1 }, name: "userId", partialFilterExpression: { userId: { $type: "string" } } },
  ]);

  await db.collection("moderation_events").createIndexes([
    { key: { issueId: 1, createdAt: -1 }, name: "issue_created" },
    { key: { actorId: 1, createdAt: -1 }, name: "actor_created" },
    { key: { createdAt: -1 }, name: "createdAt" },
  ]);

  await db.collection("rate_limits").createIndexes([
    { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
  ]);
}
