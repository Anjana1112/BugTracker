import type { Request, Response, NextFunction } from "express";
import "dotenv/config";
import jwt from "jsonwebtoken";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is missing");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
        res.status(401).json({ message: "Missing or invalid Authorization header" });
        return;
    }

    try {
        const payload = jwt.verify(token, jwtSecret as string) as unknown as {
            userId: number;
            username: string;
            email: string;
            role: string;
        };

        // A valid signature only proves the token was once issued for this
        // userId — it says nothing about whether that account still exists
        // or is still active. Re-check the DB so a hard-deleted user, or a
        // self-deleted/anonymized one (deletedAt set by DELETE /users/me),
        // can't keep using an old token until it naturally expires. Not
        // password === null: GitHub-only accounts legitimately have no
        // password and must still be able to authenticate.
        const user = await prisma.user.findUnique({
            where: { userId: payload.userId },
            select: { deletedAt: true },
        });
        if (!user || user.deletedAt !== null) {
            res.status(401).json({ message: "Invalid or expired token" });
            return;
        }

        req.user = payload;
        next();
    } catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}
