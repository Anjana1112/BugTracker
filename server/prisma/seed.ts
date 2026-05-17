import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toPrismaKey(fileName: string) {
    const base = path.basename(fileName, path.extname(fileName));
    return base.charAt(0).toLowerCase() + base.slice(1);
}

async function deleteAllData(orderedFileNames: string[]) {
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


async function main() {
    const dataDir = path.join(__dirname, "seedData");

    // children -> parents
    const orderedFileNames = [
        "comment.json",
        "ticketAssignment.json",
        "ticket.json",
        "project.json",
        "user.json",
    ];

    await deleteAllData(orderedFileNames);

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
            } else {
                await model.create({ data });
            }
        }

        console.log(`Seeded ${key} with data from ${fileName}`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});