import { runMigrations } from "../migrations";
import { connect } from "./lib/connect";

async function main() {
  const { client, db, dbName } = await connect();
  try {
    console.log(`Migrating database "${dbName}"`);
    const ran = await runMigrations(db, console.log);
    console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Already up to date.");
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
