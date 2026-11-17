import { MongoClient } from "mongodb";
import { existsSync, readFileSync } from "node:fs";

/** Minimal .env.local / .env loader so scripts work without extra deps. */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      const [, key, raw] = m as unknown as [string, string, string];
      if (process.env[key] !== undefined) continue;
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
}

export async function connect() {
  loadEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes("<")) {
    console.error("MONGODB_URI is not set (or still a placeholder). Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const dbName = process.env.MONGODB_DB || "amarelaka";
  return { client, db: client.db(dbName), dbName };
}
