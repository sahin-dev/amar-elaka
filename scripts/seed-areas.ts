/**
 * Upserts reference areas. Safe to run in any environment and idempotent:
 * existing areas keep their IDs; names and boundaries are updated.
 */
import { randomUUID } from "node:crypto";
import { AREAS, bboxPolygon } from "./data/areas";
import { connect } from "./lib/connect";

async function main() {
  const { client, db, dbName } = await connect();
  try {
    const col = db.collection("areas");
    const now = new Date();
    let created = 0;
    for (const a of AREAS) {
      const [w, s, e, n] = a.bbox;
      const res = await col.updateOne(
        { slug: a.slug },
        {
          $set: {
            name: a.name,
            city: a.city,
            boundary: bboxPolygon(a.bbox),
            center: { type: "Point", coordinates: [(w + e) / 2, (s + n) / 2] },
            isActive: true,
            updatedAt: now,
          },
          $setOnInsert: { _id: randomUUID() as unknown as never, createdAt: now },
        },
        { upsert: true },
      );
      if (res.upsertedCount) created++;
    }
    console.log(`Areas in "${dbName}": ${AREAS.length} upserted (${created} new).`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("Seeding areas failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
