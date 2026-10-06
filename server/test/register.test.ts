import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { register } from "../src/controllers/authController.js";
import { createAuthRateLimiter } from "../src/middleware/rateLimit.js";
import { prisma } from "./setup.js";
import { createUser } from "./factories.js";

const validBody = {
    username: "NewUser",
    email: "new.user@example.com",
    password: "s3cure-pass",
};

describe("POST /api/register", () => {
    it("creates a DEVELOPER account and returns a token like /api/login", async () => {
        const res = await request(app).post("/api/register").send(validBody);

        expect(res.status).toBe(201);
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body.user).toMatchObject({
            username: "NewUser",
            email: "new.user@example.com",
            role: "DEVELOPER",
        });
        expect(res.body.user.password).toBeUndefined();

        const stored = await prisma.user.findUnique({ where: { email: "new.user@example.com" } });
        expect(stored).not.toBeNull();
        expect(stored!.password).not.toBe(validBody.password);
        expect(await bcrypt.compare(validBody.password, stored!.password!)).toBe(true);
    });

    it("lets the new account log in afterwards", async () => {
        await request(app).post("/api/register").send(validBody).expect(201);

        const res = await request(app)
            .post("/api/login")
            .send({ email: validBody.email, password: validBody.password });

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(validBody.email);
    });

    it("never lets the request body set the role", async () => {
        const res = await request(app)
            .post("/api/register")
            .send({ ...validBody, role: "ADMIN" });

        expect(res.status).toBe(201);
        expect(res.body.user.role).toBe("DEVELOPER");
        const stored = await prisma.user.findUnique({ where: { email: validBody.email } });
        expect(stored!.role).toBe("DEVELOPER");
    });

    it("normalizes the email to lowercase and trims whitespace", async () => {
        const res = await request(app)
            .post("/api/register")
            .send({ ...validBody, email: "  New.User@Example.COM " });

        expect(res.status).toBe(201);
        expect(res.body.user.email).toBe("new.user@example.com");
    });

    it("rejects a duplicate email with 409, case-insensitively", async () => {
        await createUser({ email: "taken@example.com" });

        const res = await request(app)
            .post("/api/register")
            .send({ ...validBody, email: "TAKEN@example.com" });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe("An account with this email already exists");
        expect(await prisma.user.count()).toBe(1);
    });

    it("rejects a duplicate username with 409", async () => {
        await createUser({ username: "NewUser" });

        const res = await request(app).post("/api/register").send(validBody);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe("That username is already taken");
    });

    it.each([
        ["not-an-email"],
        ["missing-at.example.com"],
        ["no-domain@"],
        ["spaces in@example.com"],
    ])("rejects invalid email %s with 400", async (email) => {
        const res = await request(app).post("/api/register").send({ ...validBody, email });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("email must be a valid email address");
    });

    it("rejects a password shorter than 8 characters", async () => {
        const res = await request(app)
            .post("/api/register")
            .send({ ...validBody, password: "short7!" });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Password must be at least 8 characters");
        expect(await prisma.user.count()).toBe(0);
    });

    it("rejects a non-string password", async () => {
        const res = await request(app)
            .post("/api/register")
            .send({ ...validBody, password: 12345678 });
        expect(res.status).toBe(400);
    });

    it.each([["username"], ["email"], ["password"]])("requires %s", async (field) => {
        const body: Record<string, string> = { ...validBody };
        delete body[field];

        const res = await request(app).post("/api/register").send(body);
        expect(res.status).toBe(400);
    });

    it("refuses the reserved demo-account email domain", async () => {
        const res = await request(app)
            .post("/api/register")
            .send({ ...validBody, email: "demo-admin@bugtracker.app" });

        expect(res.status).toBe(400);
        expect(await prisma.user.count()).toBe(0);
    });

    it("is mounted behind a rate limiter", async () => {
        const res = await request(app).post("/api/register").send(validBody);
        expect(res.headers["ratelimit-policy"]).toBeDefined();
    });
});

describe("auth rate limiter", () => {
    it("returns 429 once the per-IP limit is exhausted", async () => {
        const limited = express();
        limited.use(express.json());
        limited.post("/register", createAuthRateLimiter({ limit: 2 }), register);

        const attempt = () =>
            request(limited).post("/register").send({ ...validBody, password: "short" });

        expect((await attempt()).status).toBe(400);
        expect((await attempt()).status).toBe(400);

        const blocked = await attempt();
        expect(blocked.status).toBe(429);
        expect(blocked.body.message).toMatch(/too many attempts/i);
    });
});
