import type { Request, Response } from "express";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// GET /tickets/:ticketId/comments
export const getTicketComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = Number(req.params.ticketId);
    if (isNaN(ticketId)) {
      res.status(400).json({ message: "Invalid ticket id" });
      return;
    }

    const comments = await prisma.comment.findMany({
      where: { ticketId },
      include: {
        author: {
          select: { userId: true, username: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(comments);
  } catch (err: any) {
    res.status(500).json({ message: `Error fetching comments: ${err.message}` });
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

    const { text, userId, attachmentURLs } = req.body as {
      text: string;
      userId: number;
      attachmentURLs?: string[];
    };

    if (!text || !userId) {
      res.status(400).json({ message: "text and userId are required" });
      return;
    }

    const ticket = await prisma.ticket.findUnique({ where: { ticketId } });
    if (!ticket) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        text,
        ticketId,
        userId: Number(userId),
        ...(attachmentURLs && { attachmentURLs }),
      },
      include: {
        author: {
          select: { userId: true, username: true, email: true },
        },
      },
    });

    res.status(201).json(comment);
  } catch (err: any) {
    res.status(500).json({ message: `Error creating comment: ${err.message}` });
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

    const { text, attachmentURLs } = req.body as {
      text?: string;
      attachmentURLs?: string[];
    };

    if (!text && !attachmentURLs) {
      res.status(400).json({ message: "text or attachmentURLs is required" });
      return;
    }

    const existing = await prisma.comment.findUnique({ where: { commentId } });
    if (!existing) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    const updated = await prisma.comment.update({
      where: { commentId },
      data: {
        ...(text && { text }),
        ...(attachmentURLs && { attachmentURLs }),
      },
      include: {
        author: {
          select: { userId: true, username: true, email: true },
        },
      },
    });

    res.status(200).json(updated);
  } catch (err: any) {
    res.status(500).json({ message: `Error editing comment: ${err.message}` });
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

    const existing = await prisma.comment.findUnique({ where: { commentId } });
    if (!existing) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    await prisma.comment.delete({ where: { commentId } });

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: `Error deleting comment: ${err.message}` });
  }
};

// DELETE /comments/:commentId/attachments
// Removes a specific URL from the attachmentURLs array
export const deleteCommentAttachment = async (req: Request, res: Response): Promise<void> => {
  try {
    const commentId = Number(req.params.commentId);
    if (isNaN(commentId)) {
      res.status(400).json({ message: "Invalid comment id" });
      return;
    }

    const { fileURL } = req.body as { fileURL: string };
    if (!fileURL) {
      res.status(400).json({ message: "fileURL is required" });
      return;
    }

    const existing = await prisma.comment.findUnique({ where: { commentId } });
    if (!existing) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    const updated = await prisma.comment.update({
      where: { commentId },
      data: {
        attachmentURLs: {
          set: existing.attachmentURLs.filter((url) => url !== fileURL),
        },
      },
    });

    res.status(200).json(updated);
  } catch (err: any) {
    res.status(500).json({ message: `Error deleting attachment: ${err.message}` });
  }
};

// POST /comments/:commentId/attachments
// Adds a URL to the attachmentURLs array
export const addCommentAttachment = async (req: Request, res: Response): Promise<void> => {
  try {
    const commentId = Number(req.params.commentId);
    if (isNaN(commentId)) {
      res.status(400).json({ message: "Invalid comment id" });
      return;
    }

    const { fileURL } = req.body as { fileURL: string };
    if (!fileURL) {
      res.status(400).json({ message: "fileURL is required" });
      return;
    }

    const existing = await prisma.comment.findUnique({ where: { commentId } });
    if (!existing) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    const updated = await prisma.comment.update({
      where: { commentId },
      data: {
        attachmentURLs: {
          push: fileURL,
        },
      },
    });

    res.status(200).json(updated);
  } catch (err: any) {
    res.status(500).json({ message: `Error adding attachment: ${err.message}` });
  }
};