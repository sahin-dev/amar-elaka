import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

/**
 * Starts an in-process MongoDB for integration tests. No Atlas account,
 * Docker or network database is needed. (The first run downloads a mongod
 * binary into the mongodb-memory-server cache.)
 */
let server: MongoMemoryServer | undefined;

export async function setup(project: TestProject) {
  server = await MongoMemoryServer.create();
  project.provide("mongoUri", server.getUri());
}

export async function teardown() {
  await server?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
