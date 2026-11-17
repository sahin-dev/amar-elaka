import { inject } from "vitest";

process.env.MONGODB_URI = inject("mongoUri");
// Each test file gets its own database so files cannot interfere.
process.env.MONGODB_DB = `amarelaka_test_${Math.random().toString(36).slice(2, 10)}`;
process.env.IP_HASH_SECRET = "test-secret-test-secret-test-secret";
process.env.APP_URL = "http://localhost:3000";
