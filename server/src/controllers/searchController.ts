import type { Request, Response } from "express";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export const globalSearch = async (req: Request, res: Response) => {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) return res.json({ tickets: [], projects: [], users: [] });

    const userId = req.user!.userId;

    const [tickets, projects, users] = await Promise.all([
        prisma.ticket.findMany({
        where: {
            project: { teamMembers: { some: { userId } } },
            OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            ],
        },
        select: { ticketId: true, title: true, status: true, priority: true, projectId: true },
        take: 5,
        }),
        prisma.project.findMany({
        where: {
            teamMembers: { some: { userId } },
            OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            ],
        },
        select: { projectId: true, name: true, description: true },
        take: 5,
        }),
        prisma.user.findMany({
        where: {
            OR: [
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            ],
        },
        select: { userId: true, username: true, email: true, role: true },
        take: 5,
        }),
    ]);

    return res.json({ tickets, projects, users });
};