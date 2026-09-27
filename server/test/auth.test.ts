import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { createUser } from "./factories.js";
import { authHeader } from "./authHelper.js";

describe("POST /api/login", () => {
    it("logs in with correct email/password (happy path)", async () => {
        const user = await createUser({ password: "correct-horse" });

        const res = await request(app)
            .post("/api/login")
            .send({ email: user.email, password: user.plainPassword });

        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body.user.email).toBe(user.email);
        expect(res.body.user.password).toBeUndefined();
    });

    it("logs in with an email that differs only by case", async () => {
        const user = await createUser({ password: "correct-horse" });

        const res = await request(app)
            .post("/api/login")
            .send({ email: user.email.toUpperCase(), password: user.plainPassword });

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(user.email);
    });

    it("rejects a wrong password", async () => {
        const user = await createUser({ password: "correct-horse" });

        const res = await request(app)
            .post("/api/login")
            .send({ email: user.email, password: "wrong-password" });

        expect(res.status).toBe(401);
    });

    it("rejects a nonexistent email", async () => {
        const res = await request(app)
            .post("/api/login")
            .send({ email: "nobody-here@example.com", password: "anything" });

        expect(res.status).toBe(401);
    });

    it("rejects login for an account with no password set (e.g. GitHub-only)", async () => {
        const user = await createUser({ password: null });

        const res = await request(app)
            .post("/api/login")
            .send({ email: user.email, password: "anything" });

        expect(res.status).toBe(401);
    });

    it("validates missing fields", async () => {
        const res = await request(app).post("/api/login").send({ email: "x@example.com" });
        expect(res.status).toBe(400);
    });

    // deletedAt is checked explicitly, independent of the password being
    // null — this covers a user with a real password hash but deletedAt
    // set, a case deleteMyAccount itself never produces but the check
    // must not depend on that coincidence.
    it("rejects login for a deletedAt account even with a valid password hash", async () => {
        const user = await createUser({ password: "still-set", deletedAt: new Date() });

        const res = await request(app)
            .post("/api/login")
            .send({ email: user.email, password: user.plainPassword });

        expect(res.status).toBe(401);
    });
});

describe("requireAuth middleware", () => {
    it("rejects a malformed token", async () => {
        const res = await request(app)
            .get("/users")
            .set({ Authorization: "Bearer not-a-real-jwt" });
        expect(res.status).toBe(401);
    });

    it("rejects an expired token", async () => {
        const user = await createUser();
        const token = jwt.sign(
            { userId: user.userId, username: user.username, email: user.email, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: "-1s" }
        );
        const res = await request(app).get("/users").set({ Authorization: `Bearer ${token}` });
        expect(res.status).toBe(401);
    });

    it("rejects a token signed with the wrong secret", async () => {
        const user = await createUser();
        const token = jwt.sign(
            { userId: user.userId, username: user.username, email: user.email, role: user.role },
            "definitely-the-wrong-secret",
            { expiresIn: "1h" }
        );
        const res = await request(app).get("/users").set({ Authorization: `Bearer ${token}` });
        expect(res.status).toBe(401);
    });

    it("rejects a token missing the 'Bearer ' prefix", async () => {
        const user = await createUser();
        const token = jwt.sign(
            { userId: user.userId, username: user.username, email: user.email, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: "1h" }
        );
        const res = await request(app).get("/users").set({ Authorization: token });
        expect(res.status).toBe(401);
    });

    it("rejects a token for a hard-deleted user", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const target = await createUser();
        const targetAuth = authHeader(target);

        const deleteRes = await request(app)
            .delete(`/users/${target.userId}`)
            .set(authHeader(admin));
        expect(deleteRes.status).toBe(200);

        const res = await request(app).get("/users").set(targetAuth);
        expect(res.status).toBe(401);
    });

    it("rejects a token for a self-deleted/anonymized user", async () => {
        const user = await createUser({ password: "delete-me-pass" });
        const userAuth = authHeader(user);

        const deleteRes = await request(app)
            .delete("/users/me")
            .set(userAuth)
            .send({ password: user.plainPassword });
        expect(deleteRes.status).toBe(200);

        const res = await request(app).get("/users").set(userAuth);
        expect(res.status).toBe(401);
    });
});
