import type { Request, Response } from "express";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

//tickets
export const getTickets = async (req: Request, res: Response): Promise<void> =>{
    try {
        const tickets = await prisma.ticket.findMany({
            include: {
                author: true,
                ticketAssignments: {
                    include: { user: true },
                },
                comments: true,
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
        const ticket = await prisma.ticket.findUnique({
            where: { ticketId: Number(ticketId) },
            include: {
                author: true,
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
        authorUserId, 
        assignedUserIds,
    } = req.body;

    try {
        const data: any = {
            title,
            description,
            status,
            type,
            priority,
            startDate: startDate ? new Date(startDate) : null,
            dueDate: dueDate ? new Date(dueDate) : null,
            projectId: Number(projectId),
            authorUserId: Number(authorUserId),
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
            res.status(500).json({ message: `error creating ticket: ${err.message}` });
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
        const existingTicket = await prisma.ticket.findUnique({
            where: { ticketId: ticketId },
        });

        if (!existingTicket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }
        const data: any= {
            title,
            description,
            status,
            type,
            priority,
            startDate,
            dueDate
        }

        if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
            data.ticketAssignments = {
                set: assignedUserIds.map((userId: number) => ({
                userId: Number(userId),
                })),
            };
        }

        const updatedTicket = await prisma.ticket.update({
            where: { ticketId },
            data: {
                title,
                description,
                status,
                type,
                priority,
                startDate: startDate ? new Date(startDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                ticketAssignments: {
                deleteMany: {},
                createMany: {
                    data: Array.isArray(assignedUserIds)
                    ? assignedUserIds.map((userId: number) => ({ userId: Number(userId) }))
                    : [],
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
            })

        res.json(updatedTicket)
    } catch (err: any) {
        res.status(500).json({
        message: `error updating ticket: ${err.message}`,
        })
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
        const existingTicket = await prisma.ticket.findUnique({
            where: { ticketId: ticketId },
        });

        if (!existingTicket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }
        await prisma.ticket.delete({
            where: { ticketId: ticketId },
        })
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

    if (!Array.isArray(assignedUserIds)) {
        res.status(400).json({
        message: "assignedUserIds must be array of userids",
        });
        return;
    }
    try{
        const existingTicket = await prisma.ticket.findUnique({
            where: { ticketId: ticketId },
        });

        if (!existingTicket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }
        const updatedTicket = await prisma.ticket.update({
            where: { ticketId },
            data: { 
                ticketAssignments: {
                    deleteMany: {},
                    create: assignedUserIds.map((userId: number) => ({
                        userId: Number(userId),
                    })),
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
            });

            res.json(updatedTicket);
    }
    catch (err: any) {
        res.status(500).json({
        message: `error deleting ticket: ${err.message}`,
        });
    }
}
//tickets/:ticketId/status
export const updateTicketStatus = async (req: Request, res: Response): Promise<void> =>{
    const ticketId = Number(req.params.ticketId);

    if (isNaN(ticketId)) {
        res.status(400).json({ message: "Invalid ticket id" });
        return;
    }
      const { status } = req.body as {
        status?: "OPEN" | "IN_PROGRESS" | "CLOSED";
    };

    if (!status) {
        res.status(400).json({ message: "Status is required" });
        return;
    }
    try{
        const existingTicket = await prisma.ticket.findUnique({
      where: { ticketId },
    });

    if (!existingTicket) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }

    const updatedTicket = await prisma.ticket.update({
      where: { ticketId },
      data: {
        status,
      },
      select: {
        ticketId: true,
        status: true,
      },
    });

    res.json(updatedTicket);
    }catch(err:any){
        res.status(500).json({
        message: `error updating ticket status: ${err.message}`,
        });
    }

}
