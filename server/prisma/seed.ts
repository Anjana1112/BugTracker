import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Plaintext for every seeded user's login
const SEED_PASSWORD = "password123";
const seedPasswordHash = bcrypt.hashSync(SEED_PASSWORD, 10);

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toPrismaKey(fileName: string) {
    const base = path.basename(fileName, path.extname(fileName));
    return base.charAt(0).toLowerCase() + base.slice(1);
}

// project.json/ticket.json/comment.json/ticketAssignment.json all seed
// explicit ids, so deleteMany()+insert never advances their autoincrement
// sequences — the next row created through the app would collide with an
// already-seeded id (e.g. "Unique constraint failed on the fields: (id)").
// Sync each sequence to MAX(id) once seeding is done.
async function syncSequence(prisma: PrismaClient, table: string, column: string) {
    await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', '${column}'), (SELECT MAX("${column}") FROM "${table}"))`
    );
}

async function deleteAllData(prisma: PrismaClient, orderedFileNames: string[]) {
    for (const fileName of orderedFileNames) {
        const key = toPrismaKey(fileName);
        const model = (prisma as any)[key];

        if (!model?.deleteMany) {
        throw new Error(`Prisma model "${key}" not found. Check schema + generated client.`);
        }

        await model.deleteMany({});
        console.log(`Cleared data from ${key}`);
    }
}

// Reusable by both the CLI seed command (main(), below) and the test suite,
// which calls this directly against its own PrismaClient rather than going
// through `npx prisma db seed`.
export async function seed(prisma: PrismaClient): Promise<void> {
    const dataDir = path.join(__dirname, "seedData");

    // children -> parents
    const orderedFileNames = [
        "comment.json",
        "ticketAssignment.json",
        "ticket.json",
        "project.json",
        "user.json",
    ];

    await deleteAllData(prisma, orderedFileNames);

    // user.json seeds rely on autoincrement starting at 1 (unlike the other
    // seed files, it doesn't set explicit ids) — deleteMany() doesn't reset
    // the sequence, so re-running the seed without this would keep
    // incrementing userId and break every teamMembers/authorUserId FK below.
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "User_userId_seq" RESTART WITH 1`);

    // seed parents -> children (often the reverse order of deletes)
    const seedOrder = [
        "user.json",
        "project.json",
        "ticket.json",
        "comment.json",
        "ticketAssignment.json",
    ];

    for (const fileName of seedOrder) {
        const filePath = path.join(dataDir, fileName);
        const jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        const key = toPrismaKey(fileName);
        const model = (prisma as any)[key];

        if (!model?.create) {
        throw new Error(`Prisma model "${key}" not found for create()`);
        }

        for (const data of jsonData) {
            if (key === "project" && data.teamMembers) {
                const { teamMembers, ...rest } = data;
                await model.create({
                data: {
                    ...rest,
                    teamMembers: {
                    connect: teamMembers.map((id: number) => ({ userId: id }))
                    }
                }
                });
            } else if (key === "user") {
                await model.create({ data: { ...data, password: seedPasswordHash } });
            } else if (key === "comment" && data.attachments) {
                const { attachments, ...rest } = data;
                await model.create({
                data: {
                    ...rest,
                    attachments: {
                    create: attachments
                    }
                }
                });
            } else {
                await model.create({ data });
            }
        }

        console.log(`Seeded ${key} with data from ${fileName}`);
    }

    await syncSequence(prisma, "Project", "projectId");
    await syncSequence(prisma, "Ticket", "ticketId");
    await syncSequence(prisma, "Comment", "commentId");
    await syncSequence(prisma, "TicketAssignment", "id");
}

// Only runs when this file is executed directly (npm run seed / npx prisma
// db seed) — importing it elsewhere (e.g. the test suite) for the `seed`
// export alone has no side effects and doesn't require DATABASE_URL to be
// set at import time.
const isMainModule =
    process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is missing");

    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    seed(prisma)
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
