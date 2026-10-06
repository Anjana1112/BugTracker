import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { seedDemo } from "../prisma/demo-seed.js";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../src/lib/demoAccounts.js";
import { BCRYPT_COST } from "../src/lib/config.js";
import { prisma } from "./setup.js";

// The real demo seed makes ~150 round trips to the remote test database.
const SEED_TIMEOUT = 120_000;

async function runSeed() {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
        await seedDemo(prisma);
    } finally {
        log.mockRestore();
    }
}

function login(email: string, password: string) {
    return request(app).post("/api/login").send({ email, password });
}

describe("demo seed → login", () => {
    it(
        "every seeded demo account can log in with the public demo password",
        async () => {
            await runSeed();

            for (const [role, account] of Object.entries(DEMO_ACCOUNTS)) {
                const res = await login(account.email, DEMO_PASSWORD);
                expect(res.status, `${role} login`).toBe(200);
                expect(res.body.token).toEqual(expect.any(String));
                expect(res.body.user).toMatchObject({ email: account.email, role });
            }
        },
        SEED_TIMEOUT
    );

    it(
        "creates the advertised sample content",
        async () => {
            await runSeed();

            expect(await prisma.project.count()).toBe(4);
            expect(await prisma.ticket.count()).toBe(25);
            expect(await prisma.comment.count()).toBeGreaterThan(0);
            expect(await prisma.activity.count()).toBeGreaterThan(0);
        },
        SEED_TIMEOUT
    );

    it(
        "re-running is idempotent and restores a changed demo password",
        async () => {
            await runSeed();
            const counts = async () => ({
                users: await prisma.user.count(),
                projects: await prisma.project.count(),
                tickets: await prisma.ticket.count(),
                comments: await prisma.comment.count(),
                activity: await prisma.activity.count(),
            });
            const before = await counts();

            // Simulate the demo password having been changed/locked.
            await prisma.user.update({
                where: { email: DEMO_ACCOUNTS.ADMIN.email },
                data: { password: bcrypt.hashSync("someone-changed-it", BCRYPT_COST), deletedAt: new Date() },
            });
            expect((await login(DEMO_ACCOUNTS.ADMIN.email, DEMO_PASSWORD)).status).toBe(401);

            await runSeed();

            expect(await counts()).toEqual(before);
            expect((await login(DEMO_ACCOUNTS.ADMIN.email, DEMO_PASSWORD)).status).toBe(200);
        },
        SEED_TIMEOUT
    );

    it(
        "seeded teammates (no password) cannot log in",
        async () => {
            await runSeed();
            expect((await login("priya.raman@bugtracker.app", DEMO_PASSWORD)).status).toBe(401);
        },
        SEED_TIMEOUT
    );
});
