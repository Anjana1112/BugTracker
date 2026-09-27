import { describe, it, expect } from "vitest";
import request from "supertest";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import app from "../src/app.js";
import { authHeader } from "./authHelper.js";
import { createUser, createProject, createTicket, createComment } from "./factories.js";
import { prisma } from "./setup.js";
import { s3Mock } from "./s3Mock.js";

describe("GET /tickets", () => {
    it("requires auth", async () => {
        const res = await request(app).get("/tickets");
        expect(res.status).toBe(401);
    });

    it("lists only tickets in the requester's projects (happy path)", async () => {
        const member = await createUser();
        const outsider = await createUser();
        const myProject = await createProject({}, [member.userId]);
        const otherProject = await createProject({}, [outsider.userId]);
        const myTicket = await createTicket({ projectId: myProject.projectId, authorUserId: member.userId });
        await createTicket({ projectId: otherProject.projectId, authorUserId: outsider.userId });

        const res = await request(app).get("/tickets").set(authHeader(member));
        expect(res.status).toBe(200);
        expect(res.body.map((t: any) => t.ticketId)).toEqual([myTicket.ticketId]);
    });
});

describe("GET /tickets/:ticketId", () => {
    it("returns a ticket in the requester's project (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });
        const res = await request(app).get(`/tickets/${ticket.ticketId}`).set(authHeader(member));
        expect(res.status).toBe(200);
        expect(res.body.ticketId).toBe(ticket.ticketId);
    });

    it("404s for a ticket outside the requester's projects", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });
        const res = await request(app).get(`/tickets/${ticket.ticketId}`).set(authHeader(outsider));
        expect(res.status).toBe(404);
    });

    it("400s on a non-numeric id", async () => {
        const user = await createUser();
        const res = await request(app).get("/tickets/abc").set(authHeader(user));
        expect(res.status).toBe(400);
    });

    it("404s for a nonexistent id", async () => {
        const user = await createUser();
        const res = await request(app).get("/tickets/999999").set(authHeader(user));
        expect(res.status).toBe(404);
    });
});

describe("POST /tickets", () => {
    it("creates a ticket (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const res = await request(app)
            .post("/tickets")
            .set(authHeader(member))
            .send({
                title: "New bug",
                status: "OPEN",
                priority: "LOW",
                type: "BUG",
                projectId: project.projectId,
            });
        expect(res.status).toBe(201);
        expect(res.body.title).toBe("New bug");
        expect(res.body.authorUserId).toBe(member.userId);
    });

    it("rejects a missing title", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const res = await request(app)
            .post("/tickets")
            .set(authHeader(member))
            .send({ status: "OPEN", priority: "LOW", type: "BUG", projectId: project.projectId });
        expect(res.status).toBe(400);
    });

    it("rejects an invalid status enum value", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const res = await request(app)
            .post("/tickets")
            .set(authHeader(member))
            .send({
                title: "Bad status",
                status: "SOMETHING_ELSE",
                priority: "LOW",
                type: "BUG",
                projectId: project.projectId,
            });
        expect(res.status).toBe(400);
    });

    it("rejects dates outside the project's window", async () => {
        const member = await createUser();
        const project = await createProject(
            { startDate: new Date("2026-01-01"), endDate: new Date("2026-02-01") },
            [member.userId]
        );
        const res = await request(app)
            .post("/tickets")
            .set(authHeader(member))
            .send({
                title: "Out of window",
                status: "OPEN",
                priority: "LOW",
                type: "BUG",
                projectId: project.projectId,
                dueDate: "2027-01-01",
            });
        expect(res.status).toBe(400);
    });

    it("rejects an assignee who isn't a project member", async () => {
        const member = await createUser();
        const nonMember = await createUser();
        const project = await createProject({}, [member.userId]);
        const res = await request(app)
            .post("/tickets")
            .set(authHeader(member))
            .send({
                title: "Bad assignee",
                status: "OPEN",
                priority: "LOW",
                type: "BUG",
                projectId: project.projectId,
                assignedUserIds: [nonMember.userId],
            });
        expect(res.status).toBe(400);
    });

    it("404s when creating a ticket in a project the requester isn't a member of", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const res = await request(app)
            .post("/tickets")
            .set(authHeader(outsider))
            .send({ title: "Sneaky", status: "OPEN", priority: "LOW", type: "BUG", projectId: project.projectId });
        expect(res.status).toBe(404);
    });
});

describe("PATCH /tickets/:ticketId", () => {
    it("lets the author edit the ticket (happy path)", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}`)
            .set(authHeader(author))
            .send({ title: "Updated", status: "OPEN", priority: "LOW", type: "BUG" });
        expect(res.status).toBe(200);
        expect(res.body.title).toBe("Updated");
    });

    it("lets an admin edit someone else's ticket", async () => {
        const author = await createUser();
        const admin = await createUser({ role: "ADMIN" });
        const project = await createProject({}, [author.userId, admin.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}`)
            .set(authHeader(admin))
            .send({ title: "Admin edit", status: "OPEN", priority: "LOW", type: "BUG" });
        expect(res.status).toBe(200);
    });

    it("rejects a project member who is neither author nor admin", async () => {
        const author = await createUser();
        const otherMember = await createUser();
        const project = await createProject({}, [author.userId, otherMember.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}`)
            .set(authHeader(otherMember))
            .send({ title: "Hijack", status: "OPEN", priority: "LOW", type: "BUG" });
        expect(res.status).toBe(403);
    });

    it("records activity log entries only for fields that actually changed", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({
            projectId: project.projectId,
            authorUserId: author.userId,
            title: "Same title",
            priority: "LOW",
        });
        await request(app)
            .patch(`/tickets/${ticket.ticketId}`)
            .set(authHeader(author))
            .send({ title: "Same title", status: "OPEN", priority: "HIGH", type: "BUG" });

        const activity = await prisma.activity.findMany({ where: { ticketId: ticket.ticketId } });
        expect(activity).toHaveLength(1);
        expect(activity[0]?.field).toBe("priority");
    });

    it("404s for a nonexistent id", async () => {
        const user = await createUser();
        const res = await request(app)
            .patch("/tickets/999999")
            .set(authHeader(user))
            .send({ title: "Ghost", status: "OPEN", priority: "LOW", type: "BUG" });
        expect(res.status).toBe(404);
    });

    it("404s for a non-member", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}`)
            .set(authHeader(outsider))
            .send({ title: "Sneaky", status: "OPEN", priority: "LOW", type: "BUG" });
        expect(res.status).toBe(404);
    });

    it("rejects a dueDate outside the project's window", async () => {
        const author = await createUser();
        const project = await createProject(
            { startDate: new Date("2026-01-01"), endDate: new Date("2026-02-01") },
            [author.userId]
        );
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}`)
            .set(authHeader(author))
            .send({
                title: ticket.title,
                status: "OPEN",
                priority: "LOW",
                type: "BUG",
                dueDate: "2027-01-01",
            });
        expect(res.status).toBe(400);
    });
});

describe("DELETE /tickets/:ticketId", () => {
    it("lets the author delete the ticket (happy path)", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app).delete(`/tickets/${ticket.ticketId}`).set(authHeader(author));
        expect(res.status).toBe(200);

        const row = await prisma.ticket.findUnique({ where: { ticketId: ticket.ticketId } });
        expect(row).toBeNull();
    });

    it("rejects a project member who is neither author nor admin", async () => {
        const author = await createUser();
        const otherMember = await createUser();
        const project = await createProject({}, [author.userId, otherMember.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app).delete(`/tickets/${ticket.ticketId}`).set(authHeader(otherMember));
        expect(res.status).toBe(403);
    });

    it("404s for a nonexistent id", async () => {
        const user = await createUser();
        const res = await request(app).delete("/tickets/999999").set(authHeader(user));
        expect(res.status).toBe(404);
    });

    it("404s for a non-member", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });
        const res = await request(app).delete(`/tickets/${ticket.ticketId}`).set(authHeader(outsider));
        expect(res.status).toBe(404);
    });

    it("lets an admin delete someone else's ticket", async () => {
        const author = await createUser();
        const admin = await createUser({ role: "ADMIN" });
        const project = await createProject({}, [author.userId, admin.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app).delete(`/tickets/${ticket.ticketId}`).set(authHeader(admin));
        expect(res.status).toBe(200);
    });

    it("removes comments and deletes each attachment from storage (S3 mocked)", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });

        const uploadUrlRes = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments/attachments/upload-url`)
            .set(authHeader(author))
            .send({ contentType: "image/png", contentLength: 2048 });
        const { publicUrl } = uploadUrlRes.body;

        const commentRes = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(author))
            .send({ text: "with attachment", attachments: [{ url: publicUrl, originalFilename: "x.png" }] });
        const commentId = commentRes.body.commentId;

        const res = await request(app).delete(`/tickets/${ticket.ticketId}`).set(authHeader(author));
        expect(res.status).toBe(200);

        const commentRow = await prisma.comment.findUnique({ where: { commentId } });
        expect(commentRow).toBeNull();

        const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
        expect(deleteCalls).toHaveLength(1);
        expect(deleteCalls[0]?.args[0].input.Key).toBe(
            publicUrl.replace(/^https?:\/\/[^/]+\//, "")
        );
    });
});

describe("PATCH /tickets/:ticketId/assignedUsers", () => {
    it("lets the author reassign the ticket (happy path)", async () => {
        const author = await createUser();
        const newAssignee = await createUser();
        const project = await createProject({}, [author.userId, newAssignee.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/assignedUsers`)
            .set(authHeader(author))
            .send({ assignedUserIds: [newAssignee.userId] });
        expect(res.status).toBe(200);
        expect(
            res.body.ticketAssignments.some((a: any) => a.userId === newAssignee.userId)
        ).toBe(true);
    });

    it("records ASSIGNEE_ADDED / ASSIGNEE_REMOVED activity entries", async () => {
        const author = await createUser();
        const oldAssignee = await createUser();
        const newAssignee = await createUser();
        const project = await createProject({}, [author.userId, oldAssignee.userId, newAssignee.userId]);
        const ticket = await createTicket({
            projectId: project.projectId,
            authorUserId: author.userId,
            assigneeIds: [oldAssignee.userId],
        });
        await request(app)
            .patch(`/tickets/${ticket.ticketId}/assignedUsers`)
            .set(authHeader(author))
            .send({ assignedUserIds: [newAssignee.userId] });

        const added = await prisma.activity.findMany({
            where: { ticketId: ticket.ticketId, action: "ASSIGNEE_ADDED" },
        });
        const removed = await prisma.activity.findMany({
            where: { ticketId: ticket.ticketId, action: "ASSIGNEE_REMOVED" },
        });
        expect(added).toHaveLength(1);
        expect(added[0]?.newValue).toBe(String(newAssignee.userId));
        expect(removed).toHaveLength(1);
        expect(removed[0]?.oldValue).toBe(String(oldAssignee.userId));
    });

    it("rejects a non-member assignee", async () => {
        const author = await createUser();
        const nonMember = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/assignedUsers`)
            .set(authHeader(author))
            .send({ assignedUserIds: [nonMember.userId] });
        expect(res.status).toBe(400);
    });

    it("rejects a project member who is neither author nor admin", async () => {
        const author = await createUser();
        const otherMember = await createUser();
        const project = await createProject({}, [author.userId, otherMember.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/assignedUsers`)
            .set(authHeader(otherMember))
            .send({ assignedUserIds: [] });
        expect(res.status).toBe(403);
    });

    it("validates assignedUserIds must be an array", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/assignedUsers`)
            .set(authHeader(author))
            .send({ assignedUserIds: "not-an-array" });
        expect(res.status).toBe(400);
    });

    it("404s for a non-member", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/assignedUsers`)
            .set(authHeader(outsider))
            .send({ assignedUserIds: [] });
        expect(res.status).toBe(404);
    });

    it("404s for a nonexistent ticket", async () => {
        const user = await createUser();
        const res = await request(app)
            .patch("/tickets/999999/assignedUsers")
            .set(authHeader(user))
            .send({ assignedUserIds: [] });
        expect(res.status).toBe(404);
    });
});

describe("PATCH /tickets/:ticketId/status", () => {
    it("lets the author change status (happy path)", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId, status: "OPEN" });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/status`)
            .set(authHeader(author))
            .send({ status: "CLOSED" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("CLOSED");
    });

    it("lets an assignee (who is neither author nor admin) change status", async () => {
        const author = await createUser();
        const assignee = await createUser();
        const project = await createProject({}, [author.userId, assignee.userId]);
        const ticket = await createTicket({
            projectId: project.projectId,
            authorUserId: author.userId,
            status: "OPEN",
            assigneeIds: [assignee.userId],
        });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/status`)
            .set(authHeader(assignee))
            .send({ status: "IN_PROGRESS" });
        expect(res.status).toBe(200);
    });

    it("rejects a project member who is neither author, assignee, nor admin", async () => {
        const author = await createUser();
        const otherMember = await createUser();
        const project = await createProject({}, [author.userId, otherMember.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/status`)
            .set(authHeader(otherMember))
            .send({ status: "CLOSED" });
        expect(res.status).toBe(403);
    });

    it("records an activity entry only when the status actually changes", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId, status: "OPEN" });

        await request(app)
            .patch(`/tickets/${ticket.ticketId}/status`)
            .set(authHeader(author))
            .send({ status: "OPEN" }); // no-op
        await request(app)
            .patch(`/tickets/${ticket.ticketId}/status`)
            .set(authHeader(author))
            .send({ status: "CLOSED" }); // real change

        const activity = await prisma.activity.findMany({ where: { ticketId: ticket.ticketId } });
        expect(activity).toHaveLength(1);
        expect(activity[0]?.newValue).toBe("CLOSED");
    });

    it("rejects a missing status", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/status`)
            .set(authHeader(author))
            .send({});
        expect(res.status).toBe(400);
    });

    it("404s for a nonexistent id", async () => {
        const user = await createUser();
        const res = await request(app)
            .patch("/tickets/999999/status")
            .set(authHeader(user))
            .send({ status: "CLOSED" });
        expect(res.status).toBe(404);
    });

    it("404s for a non-member", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/status`)
            .set(authHeader(outsider))
            .send({ status: "CLOSED" });
        expect(res.status).toBe(404);
    });

    it("rejects an invalid status enum value", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const res = await request(app)
            .patch(`/tickets/${ticket.ticketId}/status`)
            .set(authHeader(author))
            .send({ status: "BOGUS_STATUS" });
        expect(res.status).toBe(400);
    });
});

describe("GET /tickets/:ticketId/activity", () => {
    it("returns activity for a project member (happy path)", async () => {
        const author = await createUser();
        const project = await createProject({}, [author.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId, status: "OPEN" });
        await request(app)
            .patch(`/tickets/${ticket.ticketId}/status`)
            .set(authHeader(author))
            .send({ status: "CLOSED" });

        const res = await request(app)
            .get(`/tickets/${ticket.ticketId}/activity`)
            .set(authHeader(author));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].actor.userId).toBe(author.userId);
    });

    it("404s for a non-member", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });
        const res = await request(app)
            .get(`/tickets/${ticket.ticketId}/activity`)
            .set(authHeader(outsider));
        expect(res.status).toBe(404);
    });

    it("404s for a nonexistent ticket", async () => {
        const user = await createUser();
        const res = await request(app)
            .get("/tickets/999999/activity")
            .set(authHeader(user));
        expect(res.status).toBe(404);
    });
});
