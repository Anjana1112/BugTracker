import type { Request, Response } from "express";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { ValidationError, requireNonEmptyString, assertAttachmentMeta } from "../lib/validation.js";
import { handleControllerError } from "../lib/errorHandler.js";
import {
    createUploadTarget,
    verifyUploadedObject,
    deleteAttachment,
    attachmentUrlBelongsToTicket,
} from "../lib/storage.js";
import { ticketMemberWhere, commentMemberWhere } from "../lib/access.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const attachmentInclude = {
    attachments: true,
    author: {
        select: { userId: true, username: true, email: true },
    },
} as const;

type IncomingAttachment = { url: string; originalFilename: string };

// Re-verifies each attachment against the actual stored object (not just what
// the client claimed) before it's allowed onto a comment — mimeType/size come
// from the server's own HEAD check, not the client. Deletes and rejects on
// the first violation.
async function verifyAndBuildAttachments(
    incoming: IncomingAttachment[],
    ticketId: number
): Promise<{ url: string; originalFilename: string; mimeType: string; size: number }[]> {
    const verified = [];

    for (const { url, originalFilename } of incoming) {
        if (!attachmentUrlBelongsToTicket(url, ticketId)) {
            throw new ValidationError(`Attachment is not valid for this ticket: ${url}`);
        }

        let meta;
        try {
            meta = await verifyUploadedObject(url);
        } catch {
            throw new ValidationError(`Attachment was not found in storage: ${url}`);
        }

        try {
            assertAttachmentMeta(meta.contentType, meta.size);
        } catch (err) {
            await deleteAttachment(url, `rejected upload for ticket ${ticketId}`);
            throw err;
        }

        const validFilename = requireNonEmptyString(originalFilename, "Attachment filename");
        verified.push({ url, originalFilename: validFilename, mimeType: meta.contentType, size: meta.size });
    }

    return verified;
}

// GET /tickets/:ticketId/comments
export const getTicketComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const ticketId = Number(req.params.ticketId);
        if (isNaN(ticketId)) {
            res.status(400).json({ message: "Invalid ticket id" });
            return;
        }

        const ticket = await prisma.ticket.findFirst({
            where: { ticketId, ...ticketMemberWhere(req.user!.userId) },
            select: { ticketId: true },
        });
        if (!ticket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }

        const comments = await prisma.comment.findMany({
            where: { ticketId },
            include: attachmentInclude,
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json(comments);
    } catch (err: any) {
        handleControllerError(err, res, "Error fetching comments");
    }
};

// POST /tickets/:ticketId/comments/attachments/upload-url
export const createAttachmentUploadUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const ticketId = Number(req.params.ticketId);
        if (isNaN(ticketId)) {
            res.status(400).json({ message: "Invalid ticket id" });
            return;
        }

        const ticket = await prisma.ticket.findFirst({
            where: {
                ticketId,
                project: { teamMembers: { some: { userId: req.user!.userId } } },
            },
            select: { ticketId: true },
        });
        if (!ticket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }

        const { contentType, contentLength } = req.body as {
            contentType?: string;
            contentLength?: number;
        };
        const validated = assertAttachmentMeta(contentType, contentLength);

        const { uploadUrl, publicUrl } = await createUploadTarget(ticketId, validated.contentType);

        res.status(200).json({ uploadUrl, publicUrl });
    } catch (err: any) {
        handleControllerError(err, res, "Error creating attachment upload url");
    }
};

// POST /tickets/:ticketId/comments
export const createTicketComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const ticketId = Number(req.params.ticketId);
        if (isNaN(ticketId)) {
            res.status(400).json({ message: "Invalid ticket id" });
            return;
        }

        const { text, attachments } = req.body as {
            text: string;
            attachments?: IncomingAttachment[];
        };

        const ticket = await prisma.ticket.findFirst({
            where: { ticketId, ...ticketMemberWhere(req.user!.userId) },
        });
        if (!ticket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }

        const validText = requireNonEmptyString(text, "text");

        const verifiedAttachments =
            attachments && attachments.length > 0
                ? await verifyAndBuildAttachments(attachments, ticketId)
                : [];

        const comment = await prisma.comment.create({
            data: {
                text: validText,
                ticketId,
                userId: req.user!.userId,
                ...(verifiedAttachments.length > 0 && {
                    attachments: { create: verifiedAttachments },
                }),
            },
            include: attachmentInclude,
        });

        res.status(201).json(comment);
    } catch (err: any) {
        handleControllerError(err, res, "Error creating comment");
    }
};

// PATCH /comments/:commentId
export const editTicketComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const commentId = Number(req.params.commentId);
        if (isNaN(commentId)) {
            res.status(400).json({ message: "Invalid comment id" });
            return;
        }

        const { text, attachments } = req.body as {
            text?: string;
            attachments?: IncomingAttachment[];
        };

        const existing = await prisma.comment.findFirst({
            where: { commentId, ...commentMemberWhere(req.user!.userId) },
            include: { attachments: true },
        });
        if (!existing) {
            res.status(404).json({ message: "Comment not found" });
            return;
        }

        if (existing.userId !== req.user!.userId) {
            res.status(403).json({ message: "Only the comment's author can edit it" });
            return;
        }

        if (!text && !attachments) {
            throw new ValidationError("text or attachments is required");
        }

        const verifiedAttachments = attachments
            ? await verifyAndBuildAttachments(attachments, existing.ticketId)
            : undefined;

        const updated = await prisma.comment.update({
            where: { commentId },
            data: {
                ...(text && { text }),
                ...(verifiedAttachments && {
                    attachments: {
                        deleteMany: {},
                        create: verifiedAttachments,
                    },
                }),
            },
            include: attachmentInclude,
        });

        if (verifiedAttachments) {
            const newUrls = new Set(verifiedAttachments.map((a) => a.url));
            const removed = existing.attachments.filter((a) => !newUrls.has(a.url));
            await Promise.all(removed.map((a) => deleteAttachment(a.url, `comment ${commentId}`)));
        }

        res.status(200).json(updated);
    } catch (err: any) {
        handleControllerError(err, res, "Error editing comment");
    }
};

// DELETE /comments/:commentId
export const deleteTicketComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const commentId = Number(req.params.commentId);
        if (isNaN(commentId)) {
            res.status(400).json({ message: "Invalid comment id" });
            return;
        }

        const existing = await prisma.comment.findFirst({
            where: { commentId, ...commentMemberWhere(req.user!.userId) },
            include: { attachments: true },
        });
        if (!existing) {
            res.status(404).json({ message: "Comment not found" });
            return;
        }

        if (existing.userId !== req.user!.userId) {
            res.status(403).json({ message: "Only the comment's author can delete it" });
            return;
        }

        await prisma.comment.delete({ where: { commentId } });

        await Promise.all(existing.attachments.map((a) => deleteAttachment(a.url, `comment ${commentId}`)));

        res.status(204).send();
    } catch (err: any) {
        handleControllerError(err, res, "Error deleting comment");
    }
};
