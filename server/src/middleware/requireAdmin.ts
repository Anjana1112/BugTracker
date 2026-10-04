import type { Request, Response, NextFunction } from "express";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Always re-checks the database rather than trusting the role claim
// embedded in the requester's JWT, which can go stale if a role changes
// after the token was issued.
export async function isAdmin(userId: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { userId },
        select: { role: true },
    });
    return user?.role === "ADMIN";
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if (!(await isAdmin(req.user!.userId))) {
            res.status(403).json({ message: "Admin access required" });
            return;
        }
        next();
    } catch (err: any) {
        res.status(500).json({ message: `error checking admin access: ${err.message}` });
    }
}
