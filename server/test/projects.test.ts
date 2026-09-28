import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { authHeader } from "./authHelper.js";
import { createUser, createProject, createTicket } from "./factories.js";
import { prisma } from "./setup.js";

describe("GET /projects", () => {
    it("requires auth", async () => {
        const res = await request(app).get("/projects");
        expect(res.status).toBe(401);
    });

    it("lists only projects the requester is a member of (happy path)", async () => {
        const member = await createUser();
        const outsider = await createUser();
        const myProject = await createProject({ name: "Mine" }, [member.userId]);
        await createProject({ name: "Not Mine" }, [outsider.userId]);

        const res = await request(app).get("/projects").set(authHeader(member));
        expect(res.status).toBe(200);
        expect(res.body.map((p: any) => p.projectId)).toEqual([myProject.projectId]);
    });
});

describe("GET /projects/:projectId", () => {
    it("returns a project the requester is a member of (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({ name: "Visible" }, [member.userId]);
        const res = await request(app)
            .get(`/projects/${project.projectId}`)
            .set(authHeader(member));
        expect(res.status).toBe(200);
        expect(res.body.projectId).toBe(project.projectId);
    });

    it("404s for a project the requester is not a member of", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({ name: "Hidden" }, [owner.userId]);
        const res = await request(app)
            .get(`/projects/${project.projectId}`)
            .set(authHeader(outsider));
        expect(res.status).toBe(404);
    });

    it("400s on a non-numeric id", async () => {
        const user = await createUser();
        const res = await request(app).get("/projects/abc").set(authHeader(user));
        expect(res.status).toBe(400);
    });

    it("404s for a nonexistent id", async () => {
        const user = await createUser();
        const res = await request(app).get("/projects/999999").set(authHeader(user));
        expect(res.status).toBe(404);
    });
});

describe("POST /projects", () => {
    it("creates a project and adds the creator as a member (happy path)", async () => {
        const user = await createUser();
        const res = await request(app)
            .post("/projects")
            .set(authHeader(user))
            .send({ name: "New Project" });
        expect(res.status).toBe(201);
        expect(res.body.teamMembers.some((m: any) => m.userId === user.userId)).toBe(true);
        expect(res.body.createdByUserId).toBe(user.userId);
    });

    it("rejects an empty name", async () => {
        const user = await createUser();
        const res = await request(app)
            .post("/projects")
            .set(authHeader(user))
            .send({ name: "" });
        expect(res.status).toBe(400);
    });

    it("rejects an end date before the start date", async () => {
        const user = await createUser();
        const res = await request(app)
            .post("/projects")
            .set(authHeader(user))
            .send({ name: "Backwards", startDate: "2026-01-01", endDate: "2025-01-01" });
        expect(res.status).toBe(400);
    });

    it("rejects a nonexistent teamMembers id", async () => {
        const user = await createUser();
        const res = await request(app)
            .post("/projects")
            .set(authHeader(user))
            .send({ name: "Bad Members", teamMembers: [999999] });
        expect(res.status).toBe(400);
    });
});

describe("PATCH /projects/:projectId", () => {
    it("edits a project's details (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({ name: "Old Name" }, [member.userId]);
        const res = await request(app)
            .patch(`/projects/${project.projectId}`)
            .set(authHeader(member))
            .send({ name: "New Name" });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("New Name");
    });

    it("records an activity log entry for a field change", async () => {
        const member = await createUser();
        const project = await createProject({ name: "Old Name" }, [member.userId]);
        await request(app)
            .patch(`/projects/${project.projectId}`)
            .set(authHeader(member))
            .send({ name: "New Name" });

        const activity = await prisma.activity.findMany({
            where: { projectId: project.projectId, field: "name" },
        });
        expect(activity).toHaveLength(1);
        expect(activity[0]?.oldValue).toBe("Old Name");
        expect(activity[0]?.newValue).toBe("New Name");
    });

    it("rejects an empty name", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const res = await request(app)
            .patch(`/projects/${project.projectId}`)
            .set(authHeader(member))
            .send({ name: "" });
        expect(res.status).toBe(400);
    });

    it("404s for a nonexistent id", async () => {
        const user = await createUser();
        const res = await request(app)
            .patch("/projects/999999")
            .set(authHeader(user))
            .send({ name: "Ghost" });
        expect(res.status).toBe(404);
    });

    it("rejects a non-member editing the project", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({ name: "Private" }, [owner.userId]);
        const res = await request(app)
            .patch(`/projects/${project.projectId}`)
            .set(authHeader(outsider))
            .send({ name: "Hijacked" });
        expect(res.status).toBe(404);
    });
});

describe("DELETE /projects/:projectId", () => {
    it("deletes a project (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const res = await request(app)
            .delete(`/projects/${project.projectId}`)
            .set(authHeader(member));
        expect(res.status).toBe(200);

        const row = await prisma.project.findUnique({ where: { projectId: project.projectId } });
        expect(row).toBeNull();
    });

    it("404s for a nonexistent id", async () => {
        const user = await createUser();
        const res = await request(app).delete("/projects/999999").set(authHeader(user));
        expect(res.status).toBe(404);
    });

    it("rejects a non-member deleting the project", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({ name: "Private" }, [owner.userId]);
        const res = await request(app)
            .delete(`/projects/${project.projectId}`)
            .set(authHeader(outsider));
        expect(res.status).toBe(404);

        const row = await prisma.project.findUnique({ where: { projectId: project.projectId } });
        expect(row).not.toBeNull();
    });

    it("removes the project's tickets along with it", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        const res = await request(app)
            .delete(`/projects/${project.projectId}`)
            .set(authHeader(member));
        expect(res.status).toBe(200);

        const ticketRow = await prisma.ticket.findUnique({ where: { ticketId: ticket.ticketId } });
        expect(ticketRow).toBeNull();
    });
});

describe("GET /projects/:projectId/tickets", () => {
    it("lists a project's tickets (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });
        const res = await request(app)
            .get(`/projects/${project.projectId}/tickets`)
            .set(authHeader(member));
        expect(res.status).toBe(200);
        expect(res.body.map((t: any) => t.ticketId)).toContain(ticket.ticketId);
    });

    it("404s for a non-member", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const res = await request(app)
            .get(`/projects/${project.projectId}/tickets`)
            .set(authHeader(outsider));
        expect(res.status).toBe(404);
    });

    it("orders by createdAt descending (most recently created first)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const t1 = await createTicket({ projectId: project.projectId, authorUserId: member.userId });
        const t2 = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        await prisma.ticket.update({ where: { ticketId: t1.ticketId }, data: { createdAt: new Date("2020-01-01") } });
        await prisma.ticket.update({ where: { ticketId: t2.ticketId }, data: { createdAt: new Date("2020-01-02") } });

        const res = await request(app)
            .get(`/projects/${project.projectId}/tickets`)
            .set(authHeader(member));
        expect(res.status).toBe(200);
        expect(res.body.map((t: any) => t.ticketId)).toEqual([t2.ticketId, t1.ticketId]);
    });
});

describe("GET /projects/:projectId/members", () => {
    it("lists a project's members (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const res = await request(app)
            .get(`/projects/${project.projectId}/members`)
            .set(authHeader(member));
        expect(res.status).toBe(200);
        expect(res.body.map((m: any) => m.userId)).toContain(member.userId);
    });

    it("404s for a non-member", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const res = await request(app)
            .get(`/projects/${project.projectId}/members`)
            .set(authHeader(outsider));
        expect(res.status).toBe(404);
    });
});

describe("POST /projects/:projectId/members", () => {
    it("lets an admin add a member (happy path)", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const newMember = await createUser();
        const project = await createProject({}, [admin.userId]);
        const res = await request(app)
            .post(`/projects/${project.projectId}/members`)
            .set(authHeader(admin))
            .send({ teamMembers: [newMember.userId] });
        expect(res.status).toBe(200);
        expect(res.body.teamMembers.some((m: any) => m.userId === newMember.userId)).toBe(true);
    });

    // Per explicit product decision: an admin manages any project's roster
    // regardless of their own membership — this route is requireAdmin-gated
    // only, deliberately not scoped by projectMemberWhere().
    it("lets an admin who is NOT a project member add a member", async () => {
        const owner = await createUser();
        const admin = await createUser({ role: "ADMIN" });
        const newMember = await createUser();
        const project = await createProject({}, [owner.userId]);
        const res = await request(app)
            .post(`/projects/${project.projectId}/members`)
            .set(authHeader(admin))
            .send({ teamMembers: [newMember.userId] });
        expect(res.status).toBe(200);
        expect(res.body.teamMembers.some((m: any) => m.userId === newMember.userId)).toBe(true);
    });

    it("records an activity log entry", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const newMember = await createUser();
        const project = await createProject({}, [admin.userId]);
        await request(app)
            .post(`/projects/${project.projectId}/members`)
            .set(authHeader(admin))
            .send({ teamMembers: [newMember.userId] });

        const activity = await prisma.activity.findMany({
            where: { projectId: project.projectId, action: "MEMBER_ADDED" },
        });
        expect(activity).toHaveLength(1);
        expect(activity[0]?.newValue).toBe(String(newMember.userId));
    });

    it("lets the project's creator (a non-admin) add a member", async () => {
        const creator = await createUser();
        const newMember = await createUser();
        const project = await createProject({ createdByUserId: creator.userId }, [creator.userId]);
        const res = await request(app)
            .post(`/projects/${project.projectId}/members`)
            .set(authHeader(creator))
            .send({ teamMembers: [newMember.userId] });
        expect(res.status).toBe(200);
        expect(res.body.teamMembers.some((m: any) => m.userId === newMember.userId)).toBe(true);
    });

    it("rejects a non-admin who is not the project's creator", async () => {
        const creator = await createUser();
        const user = await createUser();
        const newMember = await createUser();
        const project = await createProject({ createdByUserId: creator.userId }, [creator.userId, user.userId]);
        const res = await request(app)
            .post(`/projects/${project.projectId}/members`)
            .set(authHeader(user))
            .send({ teamMembers: [newMember.userId] });
        expect(res.status).toBe(403);
    });

    it("rejects a nonexistent user id", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const project = await createProject({}, [admin.userId]);
        const res = await request(app)
            .post(`/projects/${project.projectId}/members`)
            .set(authHeader(admin))
            .send({ teamMembers: [999999] });
        expect(res.status).toBe(400);
    });

    it("rejects an empty teamMembers array", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const project = await createProject({}, [admin.userId]);
        const res = await request(app)
            .post(`/projects/${project.projectId}/members`)
            .set(authHeader(admin))
            .send({ teamMembers: [] });
        expect(res.status).toBe(400);
    });

    it("404s for a nonexistent project", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const newMember = await createUser();
        const res = await request(app)
            .post("/projects/999999/members")
            .set(authHeader(admin))
            .send({ teamMembers: [newMember.userId] });
        expect(res.status).toBe(404);
    });

    it("adding an already-existing member is idempotent (no duplicate membership or activity)", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const existingMember = await createUser();
        const project = await createProject({}, [admin.userId, existingMember.userId]);

        const res = await request(app)
            .post(`/projects/${project.projectId}/members`)
            .set(authHeader(admin))
            .send({ teamMembers: [existingMember.userId] });
        expect(res.status).toBe(200);

        const memberRows = res.body.teamMembers.filter(
            (m: any) => m.userId === existingMember.userId
        );
        expect(memberRows).toHaveLength(1);

        const activity = await prisma.activity.findMany({
            where: {
                projectId: project.projectId,
                action: "MEMBER_ADDED",
                newValue: String(existingMember.userId),
            },
        });
        expect(activity).toHaveLength(0);
    });
});

describe("DELETE /projects/:projectId/members/:userId", () => {
    it("lets an admin remove a member (happy path)", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const member = await createUser();
        const project = await createProject({}, [admin.userId, member.userId]);
        const res = await request(app)
            .delete(`/projects/${project.projectId}/members/${member.userId}`)
            .set(authHeader(admin));
        expect(res.status).toBe(200);
        expect(res.body.teamMembers.some((m: any) => m.userId === member.userId)).toBe(false);
    });

    // Same product decision as POST /members above: admin bypasses
    // membership entirely for this route.
    it("lets an admin who is NOT a project member remove a member", async () => {
        const owner = await createUser();
        const member = await createUser();
        const admin = await createUser({ role: "ADMIN" });
        const project = await createProject({}, [owner.userId, member.userId]);
        const res = await request(app)
            .delete(`/projects/${project.projectId}/members/${member.userId}`)
            .set(authHeader(admin));
        expect(res.status).toBe(200);
        expect(res.body.teamMembers.some((m: any) => m.userId === member.userId)).toBe(false);
    });

    it("records an activity log entry", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const member = await createUser();
        const project = await createProject({}, [admin.userId, member.userId]);
        await request(app)
            .delete(`/projects/${project.projectId}/members/${member.userId}`)
            .set(authHeader(admin));

        const activity = await prisma.activity.findMany({
            where: { projectId: project.projectId, action: "MEMBER_REMOVED" },
        });
        expect(activity).toHaveLength(1);
        expect(activity[0]?.oldValue).toBe(String(member.userId));
    });

    it("lets the project's creator (a non-admin) remove a member", async () => {
        const creator = await createUser();
        const member = await createUser();
        const project = await createProject({ createdByUserId: creator.userId }, [creator.userId, member.userId]);
        const res = await request(app)
            .delete(`/projects/${project.projectId}/members/${member.userId}`)
            .set(authHeader(creator));
        expect(res.status).toBe(200);
        expect(res.body.teamMembers.some((m: any) => m.userId === member.userId)).toBe(false);
    });

    it("rejects a non-admin who is not the project's creator", async () => {
        const creator = await createUser();
        const user = await createUser();
        const member = await createUser();
        const project = await createProject(
            { createdByUserId: creator.userId },
            [creator.userId, user.userId, member.userId]
        );
        const res = await request(app)
            .delete(`/projects/${project.projectId}/members/${member.userId}`)
            .set(authHeader(user));
        expect(res.status).toBe(403);
    });

    it("blocks removing the last remaining member", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const project = await createProject({}, [admin.userId]);
        const res = await request(app)
            .delete(`/projects/${project.projectId}/members/${admin.userId}`)
            .set(authHeader(admin));
        expect(res.status).toBe(403);
    });

    // Chose 404 here: the membership being deleted doesn't exist, matching
    // the "resource doesn't exist" convention rather than treating it as a
    // validation (400) error.
    it("404s when removing a user who isn't a member", async () => {
        const admin = await createUser({ role: "ADMIN" });
        const nonMember = await createUser();
        const project = await createProject({}, [admin.userId]);
        const res = await request(app)
            .delete(`/projects/${project.projectId}/members/${nonMember.userId}`)
            .set(authHeader(admin));
        expect(res.status).toBe(404);
    });
});

describe("GET /projects/:projectId/activity", () => {
    it("returns activity for a member (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({ name: "Old" }, [member.userId]);
        await request(app)
            .patch(`/projects/${project.projectId}`)
            .set(authHeader(member))
            .send({ name: "New" });

        const res = await request(app)
            .get(`/projects/${project.projectId}/activity`)
            .set(authHeader(member));
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].actor.userId).toBe(member.userId);
    });

    it("404s for a non-member", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const res = await request(app)
            .get(`/projects/${project.projectId}/activity`)
            .set(authHeader(outsider));
        expect(res.status).toBe(404);
    });
});
