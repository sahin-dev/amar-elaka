import type { Db } from "mongodb";
import * as m001 from "./001_initial_schema";
import * as m002 from "./002_polls";
import * as m003 from "./003_poll_device_voters";
import * as m004 from "./004_email_verification";
import * as m005 from "./005_poll_account_voters";

/**
 * Ordered, append-only list of migrations. Never edit an applied migration;
 * add a new file instead. Applied names are recorded in `_migrations`.
 */
export const MIGRATIONS: { name: string; up: (db: Db) => Promise<void> }[] = [
  { name: "001_initial_schema", up: m001.up },
  { name: "002_polls", up: m002.up },
  { name: "003_poll_device_voters", up: m003.up },
  { name: "004_email_verification", up: m004.up },
  { name: "005_poll_account_voters", up: m005.up },
];

export async function runMigrations(db: Db, log: (msg: string) => void = () => {}): Promise<string[]> {
  const applied = db.collection<{ _id: string; appliedAt: Date }>("_migrations");
  const done = new Set((await applied.find({}).toArray()).map((d) => d._id));
  const ran: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    log(`Applying ${m.name}…`);
    await m.up(db);
    await applied.insertOne({ _id: m.name, appliedAt: new Date() });
    ran.push(m.name);
  }
  return ran;
}
