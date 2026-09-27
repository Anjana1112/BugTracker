import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { authHeader } from "./authHelper.js";
import { createUser } from "./factories.js";
import { prisma } from "./setup.js";

describe("GET /users", () => {
    it("requires auth", async () => {
        const res = await request(app).get("/users");
        expect(res.status).toBe(401);
    });

    it("lists users (happy path)", async () => {
        const user = await createUser();
        const res = await request(app).get("/users").set(authHeader(user));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((u: any) => u.userId === user.userId)).toBe(true);
        expect(res.body[0].password).toBeUndefined();
    });

    // requireAuth must not treat "no password" (GitHub-only accounts) as
    // "deactivated" — only deletedAt marks an account as deactivated.
    it("authenticates a no-password account that hasn't been deleted", async () => {
        const user = await createUser({ password: null });
        const res = await request(app).get("/users").set(authHeader(user));
        expect(res.status).toBe(200);
    });
});

describe("GET /users/:userId", () => {
    it("returns a user (happy path)", async () => {
        const user = await createUser();
        const target = await createUser();
        const res = await request(app)
            .get(`/users/${target.userId}`)
            .set(authHeader(user));
        expect(res.status).toBe(200);
        expect(res.body.userId).toBe(target.userId);
    });

    it("400s on a non-numeric id", async () => {
        const user = await createUser();
        const res = await request(app).get("/users/not-a-number").set(authHeader(user));
        expect(res.status).toBe(400);
    });

    it("404s for a nonexistent id", async () => {
        const user = await createUser();
        const res = await request(app).get("/users/999999").set(authHeader(user));
        expect(res.status).toBe(404);
    });
});

describe("PATCH /users/:userId", () => {
    it("lets a user edit their own username/email (happy path)", async () => {
        const user = await createUser();
        const res = await request(app)
            .patch(`/users/${user.userId}`)
            .set(authHeader(user))
            .send({ username: "NewName" });
        expect(res.status).toBe(200);
        expect(res.body.username).toBe("NewName");
    });

    it("rejects editing someone else's account (not self, not admin)", async () => {
        const user = await createUser();
        const target = await createUser();
        const res = await request(app)
            .patch(`/users/${target.userId}`)
            .set(authHeader(user))
            .send({ username: "Hijacked" });
        expect(res.status).toBe(403);
    });

    it("lets an admin edit another user's account", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const target = await createUser();
        const res = await request(app)
            .patch(`/users/${target.userId}`)
            .set(authHeader(admin))
            .send({ username: "AdminRenamed" });
        expect(res.status).toBe(200);
        expect(res.body.username).toBe("AdminRenamed");
    });

    it("rejects a non-admin trying to change their own role", async () => {
        const user = await createUser({ role: "DEVELOPER" });
        const res = await request(app)
            .patch(`/users/${user.userId}`)
            .set(authHeader(user))
            .send({ role: "ADMIN" });
        expect(res.status).toBe(403);
    });

    it("rejects an invalid role value", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const target = await createUser();
        const res = await request(app)
            .patch(`/users/${target.userId}`)
            .set(authHeader(admin))
            .send({ role: "SUPERUSER" });
        expect(res.status).toBe(400);
    });

    it("blocks demoting the last remaining admin", async () => {
        // Wipe every admin the seed created except this one, so it's
        // genuinely the last admin (RESTART IDENTITY CASCADE in beforeEach
        // already gave us a clean slate; the seed data does include other
        // admins, so demote them to DEVELOPER first).
        await prisma.user.updateMany({
            where: { role: "ADMIN" },
            data: { role: "DEVELOPER" },
        });
        const lastAdmin = await createUser({ role: "ADMIN" });

        const res = await request(app)
            .patch(`/users/${lastAdmin.userId}`)
            .set(authHeader(lastAdmin))
            .send({ role: "DEVELOPER" });

        expect(res.status).toBe(403);
    });

    it("404s for a nonexistent id", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const res = await request(app)
            .patch("/users/999999")
            .set(authHeader(admin))
            .send({ username: "Ghost" });
        expect(res.status).toBe(404);
    });

    it("validates that at least one field is provided", async () => {
        const user = await createUser();
        const res = await request(app)
            .patch(`/users/${user.userId}`)
            .set(authHeader(user))
            .send({});
        expect(res.status).toBe(400);
    });

    it("returns 409 (not a raw 500) when changing email to one already taken", async () => {
        const taken = await createUser();
        const user = await createUser();
        const res = await request(app)
            .patch(`/users/${user.userId}`)
            .set(authHeader(user))
            .send({ email: taken.email });
        expect(res.status).toBe(409);
    });

    it("rejects changing to an email that differs only by case from an existing user's", async () => {
        const taken = await createUser();
        const user = await createUser();
        const res = await request(app)
            .patch(`/users/${user.userId}`)
            .set(authHeader(user))
            .send({ email: taken.email.toUpperCase() });
        expect(res.status).toBe(409);
    });

    it("normalizes a new email to lowercase", async () => {
        const user = await createUser();
        const res = await request(app)
            .patch(`/users/${user.userId}`)
            .set(authHeader(user))
            .send({ email: "Mixed.Case@Example.com" });
        expect(res.status).toBe(200);
        expect(res.body.email).toBe("mixed.case@example.com");
    });

    it("lets an admin demote themselves when another admin exists", async () => {
        await createUser({ role: "ADMIN" }); // a second admin, so the guard doesn't apply
        const admin = await createUser({ role: "ADMIN" });
        const res = await request(app)
            .patch(`/users/${admin.userId}`)
            .set(authHeader(admin))
            .send({ role: "DEVELOPER" });
        expect(res.status).toBe(200);
        expect(res.body.role).toBe("DEVELOPER");
    });
});

describe("PATCH /users/:userId/password", () => {
    it("changes a user's own password (happy path)", async () => {
        const user = await createUser({ password: "old-password" });
        const res = await request(app)
            .patch(`/users/${user.userId}/password`)
            .set(authHeader(user))
            .send({ currentPassword: user.plainPassword, newPassword: "new-password-123" });
        expect(res.status).toBe(200);

        const loginRes = await request(app)
            .post("/api/login")
            .send({ email: user.email, password: "new-password-123" });
        expect(loginRes.status).toBe(200);
    });

    it("rejects the wrong current password", async () => {
        const user = await createUser({ password: "old-password" });
        const res = await request(app)
            .patch(`/users/${user.userId}/password`)
            .set(authHeader(user))
            .send({ currentPassword: "totally-wrong", newPassword: "new-password-123" });
        expect(res.status).toBe(401);
    });

    it("rejects a new password shorter than 8 characters", async () => {
        const user = await createUser({ password: "old-password" });
        const res = await request(app)
            .patch(`/users/${user.userId}/password`)
            .set(authHeader(user))
            .send({ currentPassword: user.plainPassword, newPassword: "short" });
        expect(res.status).toBe(400);
    });

    it("rejects changing someone else's password", async () => {
        const user = await createUser();
        const target = await createUser({ password: "target-password" });
        const res = await request(app)
            .patch(`/users/${target.userId}/password`)
            .set(authHeader(user))
            .send({ currentPassword: "target-password", newPassword: "new-password-123" });
        expect(res.status).toBe(403);
    });

    it("rejects for an account with no password set", async () => {
        const user = await createUser({ password: null });
        const res = await request(app)
            .patch(`/users/${user.userId}/password`)
            .set(authHeader(user))
            .send({ currentPassword: "anything", newPassword: "new-password-123" });
        expect(res.status).toBe(400);
    });
});

describe("DELETE /users/me", () => {
    it("anonymizes the caller's own account (happy path)", async () => {
        const user = await createUser({ password: "delete-me-pass" });
        const res = await request(app)
            .delete("/users/me")
            .set(authHeader(user))
            .send({ password: user.plainPassword });
        expect(res.status).toBe(200);

        const row = await prisma.user.findUniqueOrThrow({ where: { userId: user.userId } });
        expect(row.username).toBe(`deleted-user-${user.userId}`);
        expect(row.password).toBeNull();

        const loginRes = await request(app)
            .post("/api/login")
            .send({ email: user.email, password: user.plainPassword });
        expect(loginRes.status).toBe(401);
    });

    it("rejects the wrong password", async () => {
        const user = await createUser({ password: "delete-me-pass" });
        const res = await request(app)
            .delete("/users/me")
            .set(authHeader(user))
            .send({ password: "wrong" });
        expect(res.status).toBe(401);
    });

    it("blocks deleting the last remaining admin", async () => {
        await prisma.user.updateMany({
            where: { role: "ADMIN" },
            data: { role: "DEVELOPER" },
        });
        const lastAdmin = await createUser({ role: "ADMIN", password: "admin-pass" });

        const res = await request(app)
            .delete("/users/me")
            .set(authHeader(lastAdmin))
            .send({ password: lastAdmin.plainPassword });

        expect(res.status).toBe(403);
    });

    it("rejects with no password in the body", async () => {
        const user = await createUser({ password: "delete-me-pass" });
        const res = await request(app)
            .delete("/users/me")
            .set(authHeader(user))
            .send({});
        expect(res.status).toBe(400);
    });

    // A GitHub-only account (password: null, not yet deletedAt) is
    // distinguishable from a deactivated one via deletedAt, not password —
    // so it reaches the controller normally and, since there's no password
    // to verify, can self-delete without one.
    it("lets a no-password (e.g. GitHub-only) account delete itself without a password", async () => {
        const user = await createUser({ password: null });
        const res = await request(app)
            .delete("/users/me")
            .set(authHeader(user))
            .send({});
        expect(res.status).toBe(200);
    });
});

describe("DELETE /users/:userId", () => {
    it("lets an admin delete another user (happy path)", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const target = await createUser();
        const res = await request(app)
            .delete(`/users/${target.userId}`)
            .set(authHeader(admin));
        expect(res.status).toBe(200);

        const row = await prisma.user.findUnique({ where: { userId: target.userId } });
        expect(row).toBeNull();
    });

    it("rejects a non-admin", async () => {
        const user = await createUser();
        const target = await createUser();
        const res = await request(app)
            .delete(`/users/${target.userId}`)
            .set(authHeader(user));
        expect(res.status).toBe(403);
    });

    it("blocks an admin from deleting their own account via this route", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const res = await request(app)
            .delete(`/users/${admin.userId}`)
            .set(authHeader(admin));
        expect(res.status).toBe(403);
    });

    it("404s for a nonexistent id", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const res = await request(app).delete("/users/999999").set(authHeader(admin));
        expect(res.status).toBe(404);
    });
});
