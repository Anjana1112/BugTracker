import type { Request, Response } from "express";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import {
    requireNonEmptyString,
    validateEnumValue,
    parseOptionalDate,
    assertTicketDates,
    assertAssigneesAreProjectMembers,
    datesEqual,
    TICKET_STATUSES,
    TICKET_PRIORITIES,
    TICKET_TYPES,
} from "../lib/validation.js";
import { handleControllerError } from "../lib/errorHandler.js";
import { isAdmin } from "../middleware/requireAdmin.js";
import { diffFields, buildAssigneeActivityInputs } from "../lib/activity.js";
import { deleteAttachment } from "../lib/storage.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Full edit/delete is author-or-admin only. Re-checks the DB rather than the
// requester's JWT role claim, which can go stale — same reasoning as
// requireAdmin.ts.
async function isAuthorOrAdmin(ticketAuthorUserId: number, req: Request): Promise<boolean> {
    if (req.user!.userId === ticketAuthorUserId) return true;
    return isAdmin(req.user!.userId);
}

//tickets
export const getTickets = async (req: Request, res: Response): Promise<void> =>{
    try {
        const tickets = await prisma.ticket.findMany({
            where: { project: { teamMembers: { some: { userId: req.user!.userId } } } },
            include: {
                author: true,
                ticketAssignments: {
                    include: { user: true },
                },
                comments: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        })
        res.json(tickets)
    }
    catch(err: any){
        res.status(500).json({message: `error retrieving tickets: ${err.message}`,});
    }
}
//tickets/:ticketId
export const getTicket = async (req: Request, res: Response): Promise<void> =>{
    const ticketId = Number(req.params.ticketId);
    if (isNaN(ticketId)) {
        res.status(400).json({ message: "Invalid ticket id" });
        return;
    }
    try {
        const ticket = await prisma.ticket.findFirst({
            where: {
                ticketId: Number(ticketId),
                project: { teamMembers: { some: { userId: req.user!.userId } } },
            },
            include: {
                author: true,
                project: { select: { projectId: true, name: true } },
                ticketAssignments: {
                    include: { user: true },
                },
                comments: true,
            },
        })

        if (!ticket) {
            res.status(404).json({ message: "Ticket not found" })
            return
            }

        res.json(ticket)
    } catch (err: any) {
        res.status(500).json({message: `error retrieving ticket: ${err.message}`,})
    }
}
//tickets
export const createTicket = async (req: Request, res: Response): Promise<void> =>{
    if (!req.body || typeof req.body !== "object") {
        res.status(400).json({
         message: "Request body missing. Send JSON with Content-Type: application/json",
        });
        return;
    }

    const {
        title,
        description,
        status,
        type,
        priority,
        startDate,
        dueDate,
        projectId,
        assignedUserIds,
    } = req.body;

    try {
        const project = await prisma.project.findFirst({
            where: {
                projectId: Number(projectId),
                teamMembers: { some: { userId: req.user!.userId } },
            },
            select: {
                projectId: true,
                startDate: true,
                endDate: true,
                teamMembers: { select: { userId: true } },
            },
        });
        if (!project) {
            res.status(404).json({ message: "Project not found" });
            return;
        }

        const validTitle = requireNonEmptyString(title, "Title");
        const validStatus = validateEnumValue(status, TICKET_STATUSES, "Status");
        const validPriority = validateEnumValue(priority, TICKET_PRIORITIES, "Priority");
        const validType = validateEnumValue(type, TICKET_TYPES, "Type");
        const parsedStartDate = parseOptionalDate(startDate, "Start date");
        const parsedDueDate = parseOptionalDate(dueDate, "Due date");
        assertTicketDates(parsedStartDate, parsedDueDate, project.startDate, project.endDate);

        if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
            const memberIds = new Set(project.teamMembers.map((m) => m.userId));
            assertAssigneesAreProjectMembers(
                assignedUserIds.map((id: number) => Number(id)),
                memberIds
            );
        }

        const data: any = {
            title: validTitle,
            description,
            status: validStatus,
            type: validType,
            priority: validPriority,
            startDate: parsedStartDate,
            dueDate: parsedDueDate,
            projectId: Number(projectId),
            authorUserId: req.user!.userId,
        }

        if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
            data.ticketAssignments = {
                create: assignedUserIds.map((userId: number) => ({
                userId: Number(userId),
                })),
            };
        }

        const newTicket = await prisma.ticket.create({
        data,
        include: {
            author: {
            select: {
                userId: true,
                username: true,
                email: true,
            },
            },
            ticketAssignments: {
            include: {
                user: {
                select: {
                    userId: true,
                    username: true,
                    email: true,
                },
                },
            },
            },
        },
        });

        res.status(201).json(newTicket);
        } catch (err: any) {
            handleControllerError(err, res, "error creating ticket");
        }
}
//tickets/:ticketId
export const editTicket = async (req: Request, res: Response): Promise<void> =>{
    const ticketId = Number(req.params.ticketId);
    if (isNaN(ticketId)) {
        res.status(400).json({ message: "Invalid ticket id" });
        return;
    }
    const {
        title,
        description,
        status,
        type,
        priority,
        startDate,
        dueDate,
        assignedUserIds,
    } = req.body

    try {
        const existingTicket = await prisma.ticket.findFirst({
            where: {
                ticketId,
                project: { teamMembers: { some: { userId: req.user!.userId } } },
            },
            include: {
                project: {
                    select: {
                        startDate: true,
                        endDate: true,
                        teamMembers: { select: { userId: true } },
                    },
                },
                ticketAssignments: { select: { userId: true } },
            },
        });

        if (!existingTicket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }

        if (!(await isAuthorOrAdmin(existingTicket.authorUserId, req))) {
            res.status(403).json({ message: "Only the ticket author or an admin can edit this ticket" });
            return;
        }

        const validTitle = requireNonEmptyString(title, "Title");
        const validStatus = validateEnumValue(status, TICKET_STATUSES, "Status");
        const validPriority = validateEnumValue(priority, TICKET_PRIORITIES, "Priority");
        const validType = validateEnumValue(type, TICKET_TYPES, "Type");
        const parsedStartDate = parseOptionalDate(startDate, "Start date");
        const parsedDueDate = parseOptionalDate(dueDate, "Due date");
        // A ticket that already has out-of-range dates (e.g. from a
        // narrowed project window, or a browser autofill quirk) shouldn't
        // block editing unrelated fields — only re-validate the window if
        // this request is actually changing one of the dates.
        const datesChanged =
            !datesEqual(parsedStartDate, existingTicket.startDate) ||
            !datesEqual(parsedDueDate, existingTicket.dueDate);
        if (datesChanged) {
            assertTicketDates(
                parsedStartDate,
                parsedDueDate,
                existingTicket.project.startDate,
                existingTicket.project.endDate
            );
        }

        if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
            const memberIds = new Set(existingTicket.project.teamMembers.map((m) => m.userId));
            assertAssigneesAreProjectMembers(
                assignedUserIds.map((id: number) => Number(id)),
                memberIds
            );
        }

        const newAssigneeIds = Array.isArray(assignedUserIds)
            ? assignedUserIds.map((userId: number) => Number(userId))
            : [];
        const existingAssigneeIds = existingTicket.ticketAssignments.map((a) => a.userId);

        const fieldDiffs = diffFields(
            existingTicket,
            {
                title: validTitle,
                description,
                status: validStatus,
                priority: validPriority,
                type: validType,
                startDate: parsedStartDate,
                dueDate: parsedDueDate,
            },
            ["title", "description", "status", "priority", "type", "startDate", "dueDate"]
        );

        const activityInputs = [
            ...fieldDiffs.map((d) => ({
                action: "FIELD_CHANGED" as const,
                field: d.field,
                oldValue: d.oldValue,
                newValue: d.newValue,
                actorUserId: req.user!.userId,
                ticketId,
            })),
            ...buildAssigneeActivityInputs(existingAssigneeIds, newAssigneeIds, req.user!.userId, ticketId),
        ];

        const [updatedTicket] = await prisma.$transaction([
            prisma.ticket.update({
            where: { ticketId },
            data: {
                title: validTitle,
                description,
                status: validStatus,
                type: validType,
                priority: validPriority,
                startDate: parsedStartDate,
                dueDate: parsedDueDate,
                ticketAssignments: {
                deleteMany: {},
                createMany: {
                    data: newAssigneeIds.map((userId) => ({ userId })),
                },
                },
            },
            include: {
                author: true,
                ticketAssignments: {
                include: { user: true },
                },
                comments: true,
            },
            }),
            ...(activityInputs.length > 0 ? [prisma.activity.createMany({ data: activityInputs })] : []),
        ]);

        res.json(updatedTicket)
    } catch (err: any) {
        handleControllerError(err, res, "error updating ticket");
    }
}
//tickets/:ticketId
export const deleteTicket = async (req: Request, res: Response): Promise<void> =>{
    const ticketId = Number(req.params.ticketId);
    if (isNaN(ticketId)) {
        res.status(400).json({ message: "Invalid ticket id" });
        return;
    }
    try{
        const existingTicket = await prisma.ticket.findFirst({
            where: {
                ticketId,
                project: { teamMembers: { some: { userId: req.user!.userId } } },
            },
        });

        if (!existingTicket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }

        if (!(await isAuthorOrAdmin(existingTicket.authorUserId, req))) {
            res.status(403).json({ message: "Only the ticket author or an admin can delete this ticket" });
            return;
        }

        // Deleting the ticket cascades to its comments/attachments at the DB
        // level, but that cascade never touches R2 — fetch the attachment
        // URLs first so the actual stored objects get cleaned up too.
        const attachments = await prisma.commentAttachment.findMany({
            where: { comment: { ticketId } },
            select: { url: true, commentId: true },
        });

        await prisma.ticket.delete({
            where: { ticketId: ticketId },
        })

        await Promise.all(
            attachments.map((a) => deleteAttachment(a.url, `comment ${a.commentId} (ticket ${ticketId} deleted)`))
        );

        res.json({ message: "Ticket deleted successfully" });
    } catch (err: any) {
        res.status(500).json({
        message: `error deleting ticket: ${err.message}`,
        });
    }
}
//tickets/:ticketId/assignedUsers
export const editTicketAssignedUsers = async (req: Request, res: Response): Promise<void> =>{
    const ticketId = Number(req.params.ticketId);
    if (isNaN(ticketId)) {
        res.status(400).json({ message: "Invalid ticket id" });
        return;
    }
    const { assignedUserIds } = req.body as {
        assignedUserIds?: number[];
    };

    try{
        const existingTicket = await prisma.ticket.findFirst({
            where: {
                ticketId,
                project: { teamMembers: { some: { userId: req.user!.userId } } },
            },
            include: {
                project: { select: { teamMembers: { select: { userId: true } } } },
                ticketAssignments: { select: { userId: true } },
            },
        });

        if (!existingTicket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }

        if (!(await isAuthorOrAdmin(existingTicket.authorUserId, req))) {
            res.status(403).json({ message: "Only the ticket author or an admin can change assignees" });
            return;
        }

        if (!Array.isArray(assignedUserIds)) {
            res.status(400).json({
            message: "assignedUserIds must be array of userids",
            });
            return;
        }

        if (assignedUserIds.length > 0) {
            const memberIds = new Set(existingTicket.project.teamMembers.map((m) => m.userId));
            assertAssigneesAreProjectMembers(
                assignedUserIds.map((id) => Number(id)),
                memberIds
            );
        }

        const newAssigneeIds = assignedUserIds.map((id) => Number(id));
        const existingAssigneeIds = existingTicket.ticketAssignments.map((a) => a.userId);
        const activityInputs = buildAssigneeActivityInputs(
            existingAssigneeIds,
            newAssigneeIds,
            req.user!.userId,
            ticketId
        );

        const [updatedTicket] = await prisma.$transaction([
            prisma.ticket.update({
            where: { ticketId },
            data: {
                ticketAssignments: {
                    deleteMany: {},
                    create: newAssigneeIds.map((userId) => ({ userId })),
                    },
            },
            include: {
                author: {
                select: {
                    userId: true,
                    username: true,
                    email: true,
                },
                },
                ticketAssignments: {
                include: {
                    user: {
                    select: {
                        userId: true,
                        username: true,
                        email: true,
                    },
                    },
                },
                },
                comments: true,
            },
            }),
            ...(activityInputs.length > 0 ? [prisma.activity.createMany({ data: activityInputs })] : []),
        ]);

            res.json(updatedTicket);
    }
    catch (err: any) {
        handleControllerError(err, res, "error updating ticket assignees");
    }
}
//tickets/:ticketId/status
export const updateTicketStatus = async (req: Request, res: Response): Promise<void> =>{
    const ticketId = Number(req.params.ticketId);

    if (isNaN(ticketId)) {
        res.status(400).json({ message: "Invalid ticket id" });
        return;
    }
      const { status: rawStatus } = req.body as {
        status?: string;
    };

    try{
        const existingTicket = await prisma.ticket.findFirst({
      where: {
        ticketId,
        project: { teamMembers: { some: { userId: req.user!.userId } } },
      },
      include: {
        ticketAssignments: { select: { userId: true } },
      },
    });

    if (!existingTicket) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }

    const isAssignee = existingTicket.ticketAssignments.some(
      (a) => a.userId === req.user!.userId
    );
    if (
      req.user!.userId !== existingTicket.authorUserId &&
      !isAssignee &&
      !(await isAdmin(req.user!.userId))
    ) {
      res.status(403).json({
        message: "Only the ticket author, an assignee, or an admin can update its status",
      });
      return;
    }

    if (!rawStatus) {
        res.status(400).json({ message: "Status is required" });
        return;
    }

    const status = validateEnumValue(rawStatus, TICKET_STATUSES, "Status");

    if (status === existingTicket.status) {
      res.json({ ticketId: existingTicket.ticketId, status: existingTicket.status });
      return;
    }

    const [updatedTicket] = await prisma.$transaction([
      prisma.ticket.update({
        where: { ticketId },
        data: {
          status,
        },
        select: {
          ticketId: true,
          status: true,
        },
      }),
      prisma.activity.create({
        data: {
          action: "FIELD_CHANGED",
          field: "status",
          oldValue: existingTicket.status,
          newValue: status,
          actorUserId: req.user!.userId,
          ticketId,
        },
      }),
    ]);

    res.json(updatedTicket);
    }catch(err:any){
        handleControllerError(err, res, "error updating ticket status");
    }

}
//tickets/:ticketId/activity
export const getTicketActivity = async (req: Request, res: Response): Promise<void> => {
    const ticketId = Number(req.params.ticketId);
    if (isNaN(ticketId)) {
        res.status(400).json({ message: "Invalid ticket id" });
        return;
    }
    try {
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

        const activity = await prisma.activity.findMany({
            where: { ticketId },
            include: {
                actor: { select: { userId: true, username: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(activity);
    } catch (err: any) {
        handleControllerError(err, res, "error fetching ticket activity");
    }
};
