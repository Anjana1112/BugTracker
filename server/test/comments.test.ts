import { describe, it, expect } from "vitest";
import request from "supertest";
import { HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import app from "../src/app.js";
import { authHeader } from "./authHelper.js";
import { createUser, createProject, createTicket, createComment } from "./factories.js";
import { prisma } from "./setup.js";
import { s3Mock } from "./s3Mock.js";

describe("GET /tickets/:ticketId/comments", () => {
    it("lists a ticket's comments (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });
        const comment = await createComment({ ticketId: ticket.ticketId, userId: member.userId, text: "hello" });

        const res = await request(app)
            .get(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(member));
        expect(res.status).toBe(200);
        expect(res.body.map((c: any) => c.commentId)).toContain(comment.commentId);
    });

    it("requires auth", async () => {
        const res = await request(app).get("/tickets/1/comments");
        expect(res.status).toBe(401);
    });

    it("rejects a non-member of the ticket's project", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });
        await createComment({ ticketId: ticket.ticketId, userId: owner.userId, text: "private" });

        const res = await request(app)
            .get(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(outsider));
        expect(res.status).toBe(404);
    });

    it("404s for a nonexistent ticket", async () => {
        const user = await createUser();
        const res = await request(app)
            .get("/tickets/999999/comments")
            .set(authHeader(user));
        expect(res.status).toBe(404);
    });

    it("400s on a non-numeric ticketId", async () => {
        const user = await createUser();
        const res = await request(app).get("/tickets/abc/comments").set(authHeader(user));
        expect(res.status).toBe(400);
    });
});

describe("POST /tickets/:ticketId/comments", () => {
    it("creates a comment (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(member))
            .send({ text: "New comment" });
        expect(res.status).toBe(201);
        expect(res.body.text).toBe("New comment");
        expect(res.body.userId).toBe(member.userId);
    });

    it("rejects empty text", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });
        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(member))
            .send({ text: "" });
        expect(res.status).toBe(400);
    });

    it("404s for a nonexistent ticket", async () => {
        const user = await createUser();
        const res = await request(app)
            .post("/tickets/999999/comments")
            .set(authHeader(user))
            .send({ text: "hi" });
        expect(res.status).toBe(404);
    });

    it("rejects a non-member of the ticket's project commenting", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });

        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(outsider))
            .send({ text: "I shouldn't be able to post this" });
        expect(res.status).toBe(404);
    });

    it("creates a comment with a valid attachment (happy path, S3 mocked)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        const uploadUrlRes = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments/attachments/upload-url`)
            .set(authHeader(member))
            .send({ contentType: "image/png", contentLength: 2048 });
        expect(uploadUrlRes.status).toBe(200);
        const { publicUrl } = uploadUrlRes.body;

        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(member))
            .send({
                text: "See attached",
                attachments: [{ url: publicUrl, originalFilename: "screenshot.png" }],
            });
        expect(res.status).toBe(201);
        expect(res.body.attachments).toHaveLength(1);
        expect(res.body.attachments[0].originalFilename).toBe("screenshot.png");
        expect(res.body.attachments[0].mimeType).toBe("image/png");
    });

    it("rejects an attachment that doesn't exist in storage", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        s3Mock.on(HeadObjectCommand).rejects(new Error("NotFound"));

        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(member))
            .send({
                text: "Broken attachment",
                attachments: [
                    { url: `https://fake.example.com/attachments/${ticket.ticketId}/x.png`, originalFilename: "x.png" },
                ],
            });
        expect(res.status).toBe(400);
    });

    it("rejects an attachment url that doesn't belong to this ticket", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });
        const otherTicket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        const uploadUrlRes = await request(app)
            .post(`/tickets/${otherTicket.ticketId}/comments/attachments/upload-url`)
            .set(authHeader(member))
            .send({ contentType: "image/png", contentLength: 2048 });
        const { publicUrl } = uploadUrlRes.body;

        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(member))
            .send({
                text: "Cross-ticket attachment",
                attachments: [{ url: publicUrl, originalFilename: "x.png" }],
            });
        expect(res.status).toBe(400);
    });
});

describe("POST /tickets/:ticketId/comments/attachments/upload-url", () => {
    it("returns an upload URL (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments/attachments/upload-url`)
            .set(authHeader(member))
            .send({ contentType: "image/png", contentLength: 2048 });
        expect(res.status).toBe(200);
        expect(res.body.uploadUrl).toEqual(expect.any(String));
        expect(res.body.publicUrl).toEqual(expect.any(String));
    });

    it("rejects a disallowed MIME type", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments/attachments/upload-url`)
            .set(authHeader(member))
            .send({ contentType: "application/x-msdownload", contentLength: 2048 });
        expect(res.status).toBe(400);
    });

    it("rejects a size over the limit", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments/attachments/upload-url`)
            .set(authHeader(member))
            .send({ contentType: "image/png", contentLength: 999_999_999 });
        expect(res.status).toBe(400);
    });

    it("rejects a non-member of the ticket's project", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });

        const res = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments/attachments/upload-url`)
            .set(authHeader(outsider))
            .send({ contentType: "image/png", contentLength: 2048 });
        expect(res.status).toBe(404);
    });

    it("404s for a nonexistent ticket", async () => {
        const user = await createUser();
        const res = await request(app)
            .post("/tickets/999999/comments/attachments/upload-url")
            .set(authHeader(user))
            .send({ contentType: "image/png", contentLength: 2048 });
        expect(res.status).toBe(404);
    });
});

describe("PATCH /comments/:commentId", () => {
    it("lets the author edit their own comment (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });
        const comment = await createComment({ ticketId: ticket.ticketId, userId: member.userId, text: "old" });

        const res = await request(app)
            .patch(`/comments/${comment.commentId}`)
            .set(authHeader(member))
            .send({ text: "new" });
        expect(res.status).toBe(200);
        expect(res.body.text).toBe("new");
    });

    it("rejects editing someone else's comment", async () => {
        const author = await createUser();
        const otherMember = await createUser();
        const project = await createProject({}, [author.userId, otherMember.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const comment = await createComment({ ticketId: ticket.ticketId, userId: author.userId, text: "mine" });

        const res = await request(app)
            .patch(`/comments/${comment.commentId}`)
            .set(authHeader(otherMember))
            .send({ text: "hijacked" });
        expect(res.status).toBe(403);
    });

    it("rejects empty body (no text, no attachments)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });
        const comment = await createComment({ ticketId: ticket.ticketId, userId: member.userId });

        const res = await request(app)
            .patch(`/comments/${comment.commentId}`)
            .set(authHeader(member))
            .send({});
        expect(res.status).toBe(400);
    });

    it("404s for a nonexistent comment", async () => {
        const user = await createUser();
        const res = await request(app)
            .patch("/comments/999999")
            .set(authHeader(user))
            .send({ text: "ghost" });
        expect(res.status).toBe(404);
    });

    it("404s for a non-member of the comment's ticket project", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });
        const comment = await createComment({ ticketId: ticket.ticketId, userId: owner.userId });

        const res = await request(app)
            .patch(`/comments/${comment.commentId}`)
            .set(authHeader(outsider))
            .send({ text: "sneaky" });
        expect(res.status).toBe(404);
    });

    it("400s on a non-numeric commentId", async () => {
        const user = await createUser();
        const res = await request(app)
            .patch("/comments/abc")
            .set(authHeader(user))
            .send({ text: "x" });
        expect(res.status).toBe(400);
    });
});

describe("DELETE /comments/:commentId", () => {
    it("lets the author delete their own comment (happy path)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });
        const comment = await createComment({ ticketId: ticket.ticketId, userId: member.userId });

        const res = await request(app)
            .delete(`/comments/${comment.commentId}`)
            .set(authHeader(member));
        expect(res.status).toBe(204);

        const row = await prisma.comment.findUnique({ where: { commentId: comment.commentId } });
        expect(row).toBeNull();
    });

    it("deletes the attachment from storage as a side effect (S3 mocked)", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        const uploadUrlRes = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments/attachments/upload-url`)
            .set(authHeader(member))
            .send({ contentType: "image/png", contentLength: 2048 });
        const { publicUrl } = uploadUrlRes.body;

        const createRes = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(member))
            .send({ text: "With attachment", attachments: [{ url: publicUrl, originalFilename: "x.png" }] });
        const commentId = createRes.body.commentId;

        await request(app).delete(`/comments/${commentId}`).set(authHeader(member));

        const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
        expect(deleteCalls).toHaveLength(1);
        expect(deleteCalls[0]?.args[0].input.Key).toBe(
            publicUrl.replace(/^https?:\/\/[^/]+\//, "")
        );
    });

    it("rejects deleting someone else's comment", async () => {
        const author = await createUser();
        const otherMember = await createUser();
        const project = await createProject({}, [author.userId, otherMember.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: author.userId });
        const comment = await createComment({ ticketId: ticket.ticketId, userId: author.userId });

        const res = await request(app)
            .delete(`/comments/${comment.commentId}`)
            .set(authHeader(otherMember));
        expect(res.status).toBe(403);

        const row = await prisma.comment.findUnique({ where: { commentId: comment.commentId } });
        expect(row).not.toBeNull();
    });

    it("404s for a nonexistent comment", async () => {
        const user = await createUser();
        const res = await request(app).delete("/comments/999999").set(authHeader(user));
        expect(res.status).toBe(404);
    });

    it("404s for a non-member of the comment's ticket project", async () => {
        const outsider = await createUser();
        const owner = await createUser();
        const project = await createProject({}, [owner.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: owner.userId });
        const comment = await createComment({ ticketId: ticket.ticketId, userId: owner.userId });

        const res = await request(app)
            .delete(`/comments/${comment.commentId}`)
            .set(authHeader(outsider));
        expect(res.status).toBe(404);

        const row = await prisma.comment.findUnique({ where: { commentId: comment.commentId } });
        expect(row).not.toBeNull();
    });

    it("400s on a non-numeric commentId", async () => {
        const user = await createUser();
        const res = await request(app).delete("/comments/abc").set(authHeader(user));
        expect(res.status).toBe(400);
    });

    // Documents current behavior only (not asserting it's correct — see the
    // summary for the proposed fix, awaiting a decision before changing it):
    // deleteAttachment() swallows S3 errors internally and never throws, so
    // the comment is still deleted and the API still returns 204 even when
    // the underlying object was never actually removed from R2.
    it("[current behavior] still returns 204 and deletes the comment even if DeleteObjectCommand rejects", async () => {
        const member = await createUser();
        const project = await createProject({}, [member.userId]);
        const ticket = await createTicket({ projectId: project.projectId, authorUserId: member.userId });

        const uploadUrlRes = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments/attachments/upload-url`)
            .set(authHeader(member))
            .send({ contentType: "image/png", contentLength: 2048 });
        const { publicUrl } = uploadUrlRes.body;
        const createRes = await request(app)
            .post(`/tickets/${ticket.ticketId}/comments`)
            .set(authHeader(member))
            .send({ text: "attachment", attachments: [{ url: publicUrl, originalFilename: "x.png" }] });
        const commentId = createRes.body.commentId;

        s3Mock.on(DeleteObjectCommand).rejects(new Error("S3 is down"));

        const res = await request(app).delete(`/comments/${commentId}`).set(authHeader(member));
        expect(res.status).toBe(204);

        const row = await prisma.comment.findUnique({ where: { commentId } });
        expect(row).toBeNull();
    });
});
