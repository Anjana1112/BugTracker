import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { beforeEach, afterAll } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { resetS3Mock } from "./s3Mock.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Safety guard -----------------------------------------------------
// Tests must only ever run against server/.env.test's database. Throws and
// aborts the whole suite (not just one test) if that isn't demonstrably
// true, before any test gets a chance to touch a real database.
function assertSafeTestDatabase(): void {
    const currentUrl = process.env.DATABASE_URL;
    if (!currentUrl) {
        throw new Error(
            "SAFETY ABORT: DATABASE_URL is not set — server/.env.test wasn't loaded."
        );
    }

    const testEnvPath = path.resolve(__dirname, "../.env.test");
    if (!fs.existsSync(testEnvPath)) {
        throw new Error("SAFETY ABORT: server/.env.test does not exist.");
    }
    const testEnv = dotenv.parse(fs.readFileSync(testEnvPath, "utf-8"));
    if (!testEnv.DATABASE_URL || testEnv.DATABASE_URL !== currentUrl) {
        throw new Error(
            "SAFETY ABORT: the active DATABASE_URL does not match server/.env.test's — refusing to run tests against an unexpected database."
        );
    }

    const mainEnvPath = path.resolve(__dirname, "../.env");
    if (fs.existsSync(mainEnvPath)) {
        const mainEnv = dotenv.parse(fs.readFileSync(mainEnvPath, "utf-8"));
        if (mainEnv.DATABASE_URL && mainEnv.DATABASE_URL === currentUrl) {
            throw new Error(
                "SAFETY ABORT: DATABASE_URL matches server/.env's DATABASE_URL — refusing to run tests against the main database."
            );
        }
    }
}

assertSafeTestDatabase();

// --- Shared test Prisma client -----------------------------------------
const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });

// --- Reset between every test --------------------------------------------
// Table names taken directly from prisma/schema.prisma's models (User,
// Project, Ticket, TicketAssignment, Comment, CommentAttachment, Activity)
// plus the implicit _ProjectMembers join table Prisma generates for the
// Project<->User many-to-many relation.
const ALL_TABLES = [
    "Activity",
    "CommentAttachment",
    "Comment",
    "TicketAssignment",
    "Ticket",
    "_ProjectMembers",
    "Project",
    "User",
];

// Truncate only — no reseed. Every test builds exactly the data it needs via
// test/factories.ts, so reseeding ~100+ demo rows before every single test
// was pure overhead (and the biggest single contributor to suite runtime).
beforeEach(async () => {
    resetS3Mock();
    const quoted = ALL_TABLES.map((t) => `"${t}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
    await prisma.$disconnect();
});
