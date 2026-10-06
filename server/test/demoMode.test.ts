import { describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../src/lib/demoAccounts.js";
import { prisma } from "./setup.js";
import { createUser, createProject, createTicket, createComment } from "./factories.js";
import { authHeader } from "./authHelper.js";

const DEMO_MESSAGE = "Disabled in demo mode.";

function createDemoAdmin() {
    return createUser({ email: DEMO_ACCOUNTS.ADMIN.email, role: "ADMIN", password: DEMO_PASSWORD });
}

function createDemoDeveloper() {
    return createUser({ email: DEMO_ACCOUNTS.DEVELOPER.email, role: "DEVELOPER", password: DEMO_PASSWORD });
}

function expectDemoBlocked(res: request.Response) {
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(DEMO_MESSAGE);
}

describe("demo accounts: blocked actions", () => {
    it.each([
        ["username", { username: "RenamedByDemo" }],
        ["avatar", { profilePictureUrl: "https://example.com/x.png" }],
    ])("demo admin cannot edit another user's %s", async (_label, body) => {
        const demoAdmin = await createDemoAdmin();
        const target = await createUser({ username: "RealPerson" });

        const res = await request(app)
            .patch(`/users/${target.userId}`)
            .set(authHeader(demoAdmin))
            .send(body);

        expectDemoBlocked(res);
        const stored = await prisma.user.findUnique({ where: { userId: target.userId } });
        expect(stored!.username).toBe("RealPerson");
        expect(stored!.profilePictureUrl).toBeNull();
    });

    it("demo admin cannot delete another user", async () => {
        const demoAdmin = await createDemoAdmin();
        const victim = await createUser();

        const res = await request(app).delete(`/users/${victim.userId}`).set(authHeader(demoAdmin));

        expectDemoBlocked(res);
        expect(await prisma.user.findUnique({ where: { userId: victim.userId } })).not.toBeNull();
    });

    it("demo admin cannot change another user's role", async () => {
        const demoAdmin = await createDemoAdmin();
        const target = await createUser({ role: "DEVELOPER" });

        const res = await request(app)
            .patch(`/users/${target.userId}`)
            .set(authHeader(demoAdmin))
            .send({ role: "ADMIN" });

        expectDemoBlocked(res);
        const stored = await prisma.user.findUnique({ where: { userId: target.userId } });
        expect(stored!.role).toBe("DEVELOPER");
    });

    it("demo admin cannot change its own role", async () => {
        const demoAdmin = await createDemoAdmin();
        await createUser({ role: "ADMIN" }); // so the last-admin guard isn't what blocks it

        const res = await request(app)
            .patch(`/users/${demoAdmin.userId}`)
            .set(authHeader(demoAdmin))
            .send({ role: "DEVELOPER" });

        expectDemoBlocked(res);
    });

    it("demo admin cannot change another user's email (would lock them out)", async () => {
        const demoAdmin = await createDemoAdmin();
        const target = await createUser({ email: "real.person@example.com" });

        const res = await request(app)
            .patch(`/users/${target.userId}`)
            .set(authHeader(demoAdmin))
            .send({ email: "hijacked@example.com" });

        expectDemoBlocked(res);
        const stored = await prisma.user.findUnique({ where: { userId: target.userId } });
        expect(stored!.email).toBe("real.person@example.com");
    });

    it.each([
        ["admin", createDemoAdmin],
        ["developer", createDemoDeveloper],
    ])("demo %s cannot change its own email", async (_label, create) => {
        const demo = await create();

        const res = await request(app)
            .patch(`/users/${demo.userId}`)
            .set(authHeader(demo))
            .send({ email: "new-address@example.com" });

        expectDemoBlocked(res);
        const stored = await prisma.user.findUnique({ where: { userId: demo.userId } });
        expect(stored!.email).toBe(demo.email);
    });

    it("rejects a combined update that includes a blocked field, without applying the rest", async () => {
        const demo = await createDemoDeveloper();

        const res = await request(app)
            .patch(`/users/${demo.userId}`)
            .set(authHeader(demo))
            .send({ username: "Renamed", email: "new-address@example.com" });

        expectDemoBlocked(res);
        const stored = await prisma.user.findUnique({ where: { userId: demo.userId } });
        expect(stored!.username).toBe(demo.username);
    });

    it.each([
        ["admin", createDemoAdmin],
        ["developer", createDemoDeveloper],
    ])("demo %s cannot change its own password", async (_label, create) => {
        const demo = await create();
        const before = await prisma.user.findUnique({ where: { userId: demo.userId } });

        const res = await request(app)
            .patch(`/users/${demo.userId}/password`)
            .set(authHeader(demo))
            .send({ currentPassword: DEMO_PASSWORD, newPassword: "locked-you-out" });

        expectDemoBlocked(res);
        const after = await prisma.user.findUnique({ where: { userId: demo.userId } });
        expect(after!.password).toBe(before!.password);
        expect(await bcrypt.compare(DEMO_PASSWORD, after!.password!)).toBe(true);
    });

    it.each([
        ["admin", createDemoAdmin],
        ["developer", createDemoDeveloper],
    ])("demo %s cannot deactivate its own account", async (_label, create) => {
        const demo = await create();
        await createUser({ role: "ADMIN" }); // so the last-admin guard isn't what blocks it

        const res = await request(app)
            .delete("/users/me")
            .set(authHeader(demo))
            .send({ password: DEMO_PASSWORD });

        expectDemoBlocked(res);
        const stored = await prisma.user.findUnique({ where: { userId: demo.userId } });
        expect(stored!.deletedAt).toBeNull();
        expect(stored!.email).toBe(demo.email);
    });

    it("the public demo login still works after a blocked attempt", async () => {
        const demo = await createDemoDeveloper();
        await request(app)
            .patch(`/users/${demo.userId}/password`)
            .set(authHeader(demo))
            .send({ currentPassword: DEMO_PASSWORD, newPassword: "locked-you-out" });

        const res = await request(app)
            .post("/api/login")
            .send({ email: DEMO_ACCOUNTS.DEVELOPER.email, password: DEMO_PASSWORD });

        expect(res.status).toBe(200);
    });
});

describe("demo accounts: still allowed", () => {
    it("can browse users", async () => {
        const demoAdmin = await createDemoAdmin();
        const res = await request(app).get("/users").set(authHeader(demoAdmin));
        expect(res.status).toBe(200);
    });

    it("can change its own username", async () => {
        const demo = await createDemoDeveloper();

        const res = await request(app)
            .patch(`/users/${demo.userId}`)
            .set(authHeader(demo))
            .send({ username: "DemoRenamed" });

        expect(res.status).toBe(200);
        expect(res.body.username).toBe("DemoRenamed");
    });
});

describe("demo accounts: unchanged values pass through", () => {
    it("can save a username change when the form also sends its current email (Settings page shape)", async () => {
        const demo = await createDemoDeveloper();

        const res = await request(app)
            .patch(`/users/${demo.userId}`)
            .set(authHeader(demo))
            .send({ username: "DemoRenamed", email: demo.email.toUpperCase() });

        expect(res.status).toBe(200);
        expect(res.body.username).toBe("DemoRenamed");
        expect(res.body.email).toBe(demo.email);
    });

    it("demo admin can update its own profile when the form resends the same email and role (Edit User modal shape)", async () => {
        const demoAdmin = await createDemoAdmin();

        const res = await request(app)
            .patch(`/users/${demoAdmin.userId}`)
            .set(authHeader(demoAdmin))
            .send({ username: "MayaRenamed", email: demoAdmin.email, role: "ADMIN" });

        expect(res.status).toBe(200);
        expect(res.body.username).toBe("MayaRenamed");
    });
});

describe("non-demo accounts are unaffected", () => {
    it("a real admin can still change roles and emails", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const target = await createUser({ role: "DEVELOPER" });

        const res = await request(app)
            .patch(`/users/${target.userId}`)
            .set(authHeader(admin))
            .send({ role: "ADMIN", email: "promoted@example.com" });

        expect(res.status).toBe(200);
        expect(res.body.role).toBe("ADMIN");
        expect(res.body.email).toBe("promoted@example.com");
    });

    it("a real admin can still delete users", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const target = await createUser();

        const res = await request(app).delete(`/users/${target.userId}`).set(authHeader(admin));
        expect(res.status).toBe(200);
    });

    it("a real user can still change their password", async () => {
        const user = await createUser({ password: "original-pass" });

        const res = await request(app)
            .patch(`/users/${user.userId}/password`)
            .set(authHeader(user))
            .send({ currentPassword: "original-pass", newPassword: "brand-new-pass" });

        expect(res.status).toBe(200);
    });

    it("an address on the demo domain that isn't a demo login is not treated as demo", async () => {
        // e.g. a seeded teammate; only the public demo logins are restricted
        const teammate = await createUser({ email: "priya.raman@bugtracker.app", password: "teammate-pass" });

        const res = await request(app)
            .patch(`/users/${teammate.userId}/password`)
            .set(authHeader(teammate))
            .send({ currentPassword: "teammate-pass", newPassword: "changed-pass" });

        expect(res.status).toBe(200);
    });
});

// A demo project (demo admin + developer are members) next to a real one
// that has no demo members at all.
async function setUpProjects() {
    const demoAdmin = await createDemoAdmin();
    const demoDev = await createDemoDeveloper();
    const realUser = await createUser({ username: "RealOwner" });
    const realAdmin = await createUser({ role: "ADMIN" });

    const demoProject = await createProject(
        { name: "Demo project", createdByUserId: demoAdmin.userId },
        [demoAdmin.userId, demoDev.userId]
    );
    const realProject = await createProject(
        { name: "Real project", createdByUserId: realUser.userId },
        [realUser.userId]
    );
    const realTicket = await createTicket({ projectId: realProject.projectId, authorUserId: realUser.userId });
    const realComment = await createComment({ ticketId: realTicket.ticketId, userId: realUser.userId });

    return { demoAdmin, demoDev, realUser, realAdmin, demoProject, realProject, realTicket, realComment };
}

describe("demo accounts: confined to their own projects", () => {
    it("demo admin cannot add itself (or anyone) to a project it isn't a member of", async () => {
        const { demoAdmin, realProject } = await setUpProjects();

        const res = await request(app)
            .post(`/projects/${realProject.projectId}/members`)
            .set(authHeader(demoAdmin))
            .send({ teamMembers: [demoAdmin.userId] });

        expectDemoBlocked(res);
        const members = await prisma.project.findUnique({
            where: { projectId: realProject.projectId },
            select: { teamMembers: { select: { userId: true } } },
        });
        expect(members!.teamMembers.map((m) => m.userId)).not.toContain(demoAdmin.userId);
    });

    it("demo admin cannot remove members from a project it isn't a member of", async () => {
        const { demoAdmin, realProject } = await setUpProjects();
        const second = await createUser();
        await prisma.project.update({
            where: { projectId: realProject.projectId },
            data: { teamMembers: { connect: { userId: second.userId } } },
        });

        const res = await request(app)
            .delete(`/projects/${realProject.projectId}/members/${second.userId}`)
            .set(authHeader(demoAdmin));

        expectDemoBlocked(res);
        const project = await prisma.project.findUnique({
            where: { projectId: realProject.projectId },
            select: { teamMembers: { select: { userId: true } } },
        });
        expect(project!.teamMembers).toHaveLength(2);
    });

    it("demo admin can still manage members of its own demo project", async () => {
        const { demoAdmin, demoProject } = await setUpProjects();
        const newcomer = await createUser();

        const add = await request(app)
            .post(`/projects/${demoProject.projectId}/members`)
            .set(authHeader(demoAdmin))
            .send({ teamMembers: [newcomer.userId] });
        expect(add.status).toBe(200);

        const remove = await request(app)
            .delete(`/projects/${demoProject.projectId}/members/${newcomer.userId}`)
            .set(authHeader(demoAdmin));
        expect(remove.status).toBe(200);
    });

    it("lists and search only include the demo projects and their tickets", async () => {
        const { demoAdmin, demoProject, realProject, realTicket } = await setUpProjects();
        const demoTicket = await createTicket({ projectId: demoProject.projectId, authorUserId: demoAdmin.userId, title: "Project search target" });

        const projects = await request(app).get("/projects").set(authHeader(demoAdmin));
        expect(projects.status).toBe(200);
        expect(projects.body.map((p: { projectId: number }) => p.projectId)).toEqual([demoProject.projectId]);

        const tickets = await request(app).get("/tickets").set(authHeader(demoAdmin));
        const ticketIds = tickets.body.map((t: { ticketId: number }) => t.ticketId);
        expect(ticketIds).toContain(demoTicket.ticketId);
        expect(ticketIds).not.toContain(realTicket.ticketId);

        const search = await request(app).get("/search").query({ q: "project" }).set(authHeader(demoAdmin));
        expect(search.body.projects.map((p: { projectId: number }) => p.projectId)).not.toContain(realProject.projectId);
        expect(search.body.tickets.map((t: { ticketId: number }) => t.ticketId)).not.toContain(realTicket.ticketId);
    });

    // Every project-, ticket-, comment- and attachment-level route on the
    // real project must be invisible to the demo admin, whatever its role.
    it.each([
        ["view project", "get", (p: any) => `/projects/${p.realProject.projectId}`, undefined],
        ["edit project", "patch", (p: any) => `/projects/${p.realProject.projectId}`, { name: "Hijacked" }],
        ["delete project", "delete", (p: any) => `/projects/${p.realProject.projectId}`, undefined],
        ["list project tickets", "get", (p: any) => `/projects/${p.realProject.projectId}/tickets`, undefined],
        ["list project members", "get", (p: any) => `/projects/${p.realProject.projectId}/members`, undefined],
        ["view project activity", "get", (p: any) => `/projects/${p.realProject.projectId}/activity`, undefined],
        ["create ticket", "post", () => `/tickets`, (p: any) => ({ projectId: p.realProject.projectId, title: "x", type: "BUG", status: "OPEN", priority: "LOW" })],
        ["view ticket", "get", (p: any) => `/tickets/${p.realTicket.ticketId}`, undefined],
        ["edit ticket", "patch", (p: any) => `/tickets/${p.realTicket.ticketId}`, { title: "Hijacked" }],
        ["delete ticket", "delete", (p: any) => `/tickets/${p.realTicket.ticketId}`, undefined],
        ["change ticket status", "patch", (p: any) => `/tickets/${p.realTicket.ticketId}/status`, { status: "CLOSED" }],
        ["change assignees", "patch", (p: any) => `/tickets/${p.realTicket.ticketId}/assignedUsers`, { assignedUserIds: [] }],
        ["view ticket activity", "get", (p: any) => `/tickets/${p.realTicket.ticketId}/activity`, undefined],
        ["list comments", "get", (p: any) => `/tickets/${p.realTicket.ticketId}/comments`, undefined],
        ["add comment", "post", (p: any) => `/tickets/${p.realTicket.ticketId}/comments`, { text: "hello" }],
        ["get attachment upload URL", "post", (p: any) => `/tickets/${p.realTicket.ticketId}/comments/attachments/upload-url`, { filename: "a.png", contentType: "image/png", contentLength: 10 }],
        ["edit comment", "patch", (p: any) => `/comments/${p.realComment.commentId}`, { text: "edited" }],
        ["delete comment", "delete", (p: any) => `/comments/${p.realComment.commentId}`, undefined],
    ] as const)("cannot %s on a non-member project (404, existence not revealed)", async (_label, method, path, body) => {
        const ctx = await setUpProjects();
        const payload = typeof body === "function" ? body(ctx) : body;

        let req = request(app)[method](path(ctx)).set(authHeader(ctx.demoAdmin));
        if (payload !== undefined) req = req.send(payload);
        const res = await req;

        expect(res.status).toBe(404);
        // The controller's own "<thing> not found" — not Express's default
        // 404 for a mistyped route, which has no JSON body.
        expect(res.body.message).toMatch(/not found/i);

        // Nothing on the real project changed.
        const project = await prisma.project.findUnique({ where: { projectId: ctx.realProject.projectId } });
        expect(project!.name).toBe("Real project");
        const ticket = await prisma.ticket.findUnique({ where: { ticketId: ctx.realTicket.ticketId } });
        expect(ticket).not.toBeNull();
        expect(ticket!.title).toBe(ctx.realTicket.title);
        const comment = await prisma.comment.findUnique({ where: { commentId: ctx.realComment.commentId } });
        expect(comment!.text).toBe(ctx.realComment.text);
    });

    it("demo admin keeps full admin powers inside its own demo project", async () => {
        const { demoAdmin, demoDev, demoProject } = await setUpProjects();
        const devTicket = await createTicket({ projectId: demoProject.projectId, authorUserId: demoDev.userId });

        const edit = await request(app)
            .patch(`/tickets/${devTicket.ticketId}`)
            .set(authHeader(demoAdmin))
            .send({ title: "Retitled by demo admin", type: "BUG", status: "OPEN", priority: "HIGH" });
        expect(edit.status).toBe(200);

        const del = await request(app).delete(`/tickets/${devTicket.ticketId}`).set(authHeader(demoAdmin));
        expect(del.status).toBe(200);
    });

    it("a real admin can still manage members of a project it isn't a member of", async () => {
        const { realAdmin, realProject } = await setUpProjects();

        const res = await request(app)
            .post(`/projects/${realProject.projectId}/members`)
            .set(authHeader(realAdmin))
            .send({ teamMembers: [realAdmin.userId] });

        expect(res.status).toBe(200);
    });

    it("a real admin can still edit another user's profile", async () => {
        const { realAdmin, realUser } = await setUpProjects();

        const res = await request(app)
            .patch(`/users/${realUser.userId}`)
            .set(authHeader(realAdmin))
            .send({ username: "RenamedByAdmin" });

        expect(res.status).toBe(200);
    });
});
