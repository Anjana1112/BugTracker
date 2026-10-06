import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Loaded before anything else: every controller constructs its PrismaClient
// from process.env.DATABASE_URL at module-import time, so this must resolve
// to the test database before any test file (or its import of src/app.ts)
// is ever evaluated. override: true so a stray .env load elsewhere can't
// clobber it back to the real DATABASE_URL.
dotenv.config({ path: path.resolve(__dirname, ".env.test"), override: true });

// Low bcrypt cost for the whole test run (default production cost is 10,
// intentionally slow) — set here via config, not by editing the cost
// hardcoded in production logic. Only takes effect if not already set.
process.env.BCRYPT_COST = process.env.BCRYPT_COST ?? "4";
// Lift the per-IP auth rate limit for the suite — every request comes from
// the same IP, so the production default would 429 unrelated login tests.
// register.test.ts covers the limiter itself with an explicit small limit.
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX ?? "10000";

export default defineConfig({
  test: {
    // Forward into the actual test-running environment explicitly, rather
    // than relying on process.env inheritance into worker/fork processes.
    env: process.env as Record<string, string>,
    setupFiles: ["./test/setup.ts"],
    // Tests share one database (truncate before every test) — must run
    // strictly serially: one file at a time, in a single process, with
    // module state (the shared Prisma client, the S3 mock) reused across
    // files rather than a fresh isolated context per file.
    fileParallelism: false,
    isolate: false,
    pool: "forks",
    singleFork: true,
    // Generous timeouts: every test hits a real remote (Neon) database over
    // the network.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
